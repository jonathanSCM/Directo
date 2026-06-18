import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { uniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { GeocodingService } from '../geocoding/geocoding.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

// Vista resumida para listados (incluye imagen principal).
const listInclude = {
  property_types: { select: { id: true, name: true, slug: true } },
  zones: { select: { id: true, name: true, city: true } },
  property_images: { where: { is_main: true }, take: 1 },
} satisfies Prisma.propertiesInclude;

// Vista completa para el detalle.
const detailInclude = {
  property_types: { select: { id: true, name: true, slug: true } },
  zones: { select: { id: true, name: true, city: true } },
  property_images: { orderBy: { sort_order: 'asc' } },
  users: { select: { id: true, name: true, avatar_url: true } },
} satisfies Prisma.propertiesInclude;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ── Propietario: CRUD ──────────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreatePropertyDto) {
    if (user.active_role !== 'owner') {
      throw new ForbiddenException(
        'Cambia a modo propietario para publicar una propiedad',
      );
    }
    await this.assertTypeAndZone(dto.property_type_id, dto.zone_id);
    // §5: si hay dirección pero no coordenadas, se geocodifica.
    const { latitude, longitude } = await this.resolveCoordinates(dto);

    return this.prisma.properties.create({
      data: {
        owner_id: user.id,
        title: dto.title,
        slug: uniqueSlug(dto.title),
        description: dto.description,
        property_type_id: dto.property_type_id,
        zone_id: dto.zone_id,
        operation: dto.operation,
        price: dto.price,
        currency: dto.currency ?? 'USD',
        address: dto.address,
        latitude,
        longitude,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        area_m2: dto.area_m2,
        contact_phone: dto.contact_phone,
        whatsapp: dto.whatsapp,
        status: 'draft',
        approval_status: 'pending',
      },
      include: listInclude,
    });
  }

  async update(user: AuthUser, id: string, dto: UpdatePropertyDto) {
    await this.getOwnedOrThrow(user, id);
    if (dto.property_type_id || dto.zone_id) {
      await this.assertTypeAndZone(dto.property_type_id, dto.zone_id);
    }
    // Re-geocodifica si cambió la dirección y no se enviaron coordenadas.
    const { latitude, longitude } = await this.resolveCoordinates(dto);

    return this.prisma.properties.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        property_type_id: dto.property_type_id,
        zone_id: dto.zone_id,
        operation: dto.operation,
        price: dto.price,
        currency: dto.currency,
        address: dto.address,
        latitude,
        longitude,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        area_m2: dto.area_m2,
        contact_phone: dto.contact_phone,
        whatsapp: dto.whatsapp,
      },
      include: listInclude,
    });
  }

  async publish(user: AuthUser, id: string) {
    const prop = await this.getOwnedOrThrow(user, id);
    if (prop.status === 'taken_down') {
      throw new BadRequestException('La propiedad está dada de baja');
    }
    // Regla §18: suscripción activa y dentro del límite del plan.
    await this.subscriptions.assertCanPublish(user.id, id);
    // Regla §18: si se requiere aprobación, queda pendiente para el admin.
    if (await this.requireApproval()) {
      return this.prisma.properties.update({
        where: { id },
        data: {
          status: 'pending_approval',
          approval_status: 'pending',
          rejection_reason: null,
        },
      });
    }
    return this.prisma.properties.update({
      where: { id },
      data: {
        status: 'published',
        approval_status: 'approved',
        published_at: prop.published_at ?? new Date(),
      },
    });
  }

  async unpublish(user: AuthUser, id: string) {
    await this.getOwnedOrThrow(user, id);
    return this.prisma.properties.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.getOwnedOrThrow(user, id);
    // Baja lógica: conserva el registro y sus relaciones (chats, visitas).
    await this.prisma.properties.update({
      where: { id },
      data: { status: 'taken_down' },
    });
    return { message: 'Publicación dada de baja' };
  }

  async markSold(user: AuthUser, id: string) {
    await this.getOwnedOrThrow(user, id);
    // §6.1: estado "Vendida / alquilada".
    return this.prisma.properties.update({
      where: { id },
      data: { status: 'sold_rented' },
    });
  }

  async findMine(user: AuthUser, page = 1, limit = 20) {
    const where: Prisma.propertiesWhereInput = { owner_id: user.id };
    return this.paginate(where, [{ created_at: 'desc' }], page, limit);
  }

  // ── Público: listado y detalle ──────────────────────────────────────────────

  async findPublic(query: QueryPropertiesDto) {
    // Con texto: búsqueda full-text + fallback a LIKE en título/dirección/zona
    if (query.q && query.q.trim().length > 0) {
      const ftResult = await this.findPublicFullText(query);
      if (ftResult.data.length > 0) return ftResult;
    }
    const where = this.buildPublicWhere(query);
    const orderBy = this.buildOrderBy(query.sort ?? 'recent');
    return this.paginate(where, orderBy, query.page ?? 1, query.limit ?? 20);
  }

  async findById(user: AuthUser, id: string) {
    const prop = await this.prisma.properties.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!prop) throw new NotFoundException('Propiedad no encontrada');
    if (prop.owner_id !== user.id && !this.isAdmin(user)) {
      throw new NotFoundException('Propiedad no encontrada');
    }
    return prop;
  }

  async findBySlug(slug: string, user?: AuthUser, trackView = false) {
    const prop = await this.prisma.properties.findUnique({
      where: { slug },
      include: detailInclude,
    });
    if (!prop) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    const isVisible =
      prop.status === 'published' && prop.approval_status === 'approved';
    const isOwner = !!user && prop.owner_id === user.id;
    if (!isVisible && !isOwner && !this.isAdmin(user)) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    if (isVisible && trackView && !isOwner) {
      await this.prisma.properties.update({
        where: { id: prop.id },
        data: { views_count: { increment: 1 } },
      });
      prop.views_count += 1;
    }
    return prop;
  }

  // ── Admin: moderación (§13.3) ───────────────────────────────────────────────

  async adminApprove(id: string) {
    const prop = await this.findOrThrow(id);
    const updated = await this.prisma.properties.update({
      where: { id },
      data: {
        approval_status: 'approved',
        status: 'published',
        published_at: prop.published_at ?? new Date(),
        rejection_reason: null,
      },
    });

    await this.prisma.notifications.create({
      data: {
        user_id: prop.owner_id,
        type: 'property_approved',
        title: 'Propiedad aprobada',
        message: `Tu propiedad "${prop.title}" fue aprobada y ya está publicada.`,
        channel: 'in_app',
        status: 'pending',
        data: { property_id: id } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async adminReject(id: string, reason: string) {
    const prop = await this.findOrThrow(id);
    const updated = await this.prisma.properties.update({
      where: { id },
      data: {
        approval_status: 'rejected',
        status: 'rejected',
        rejection_reason: reason,
      },
    });

    await this.prisma.notifications.create({
      data: {
        user_id: prop.owner_id,
        type: 'property_rejected',
        title: 'Propiedad rechazada',
        message: `Tu propiedad "${prop.title}" fue rechazada. Motivo: ${reason}`,
        channel: 'in_app',
        status: 'pending',
        data: { property_id: id, reason } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async adminTakeDown(id: string) {
    const prop = await this.findOrThrow(id);
    const updated = await this.prisma.properties.update({
      where: { id },
      data: { status: 'taken_down' },
    });

    await this.prisma.notifications.create({
      data: {
        user_id: prop.owner_id,
        type: 'system',
        title: 'Propiedad dada de baja',
        message: `Tu propiedad "${prop.title}" fue dada de baja por el equipo de moderación. Contactá soporte si creés que es un error.`,
        channel: 'in_app',
        status: 'pending',
        data: { property_id: id } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async adminRestore(id: string) {
    const prop = await this.findOrThrow(id);
    if (prop.status !== 'taken_down') {
      throw new BadRequestException('La propiedad no está dada de baja');
    }
    const updated = await this.prisma.properties.update({
      where: { id },
      data: { status: 'published', approval_status: 'approved' },
    });

    await this.prisma.notifications.create({
      data: {
        user_id: prop.owner_id,
        type: 'system',
        title: 'Propiedad restaurada',
        message: `Tu propiedad "${prop.title}" ha sido restaurada y ya está publicada nuevamente.`,
        channel: 'in_app',
        status: 'pending',
        data: { property_id: id } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async adminDetail(id: string) {
    const prop = await this.prisma.properties.findUnique({
      where: { id },
      include: {
        ...detailInclude,
        users: { select: { id: true, name: true, email: true, phone: true, avatar_url: true } },
      },
    });
    if (!prop) throw new NotFoundException('Propiedad no encontrada');
    return prop;
  }

  async adminList(query: QueryPropertiesDto) {
    // El admin ve todas las propiedades, sin filtro de visibilidad.
    const where = this.buildPublicWhere(query, false);
    const orderBy = this.buildOrderBy(query.sort ?? 'recent');
    return this.paginate(where, orderBy, query.page ?? 1, query.limit ?? 20);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async paginate(
    where: Prisma.propertiesWhereInput,
    orderBy: Prisma.propertiesOrderByWithRelationInput[],
    page: number,
    limit: number,
  ) {
    const [total, data] = await this.prisma.$transaction([
      this.prisma.properties.count({ where }),
      this.prisma.properties.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: listInclude,
      }),
    ]);
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private buildPublicWhere(
    query: QueryPropertiesDto,
    onlyVisible = true,
  ): Prisma.propertiesWhereInput {
    const where: Prisma.propertiesWhereInput = {};
    if (onlyVisible) {
      where.status = 'published';
      where.approval_status = 'approved';
    }
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
        { zones: { name: { contains: query.q, mode: 'insensitive' } } },
        { zones: { city: { contains: query.q, mode: 'insensitive' } } },
      ];
    }
    if (query.type) {
      where.property_types = {
        slug: { equals: query.type, mode: 'insensitive' },
      };
    }
    if (query.zone_id) {
      where.zone_id = query.zone_id;
    }
    if (query.city) {
      where.zones = { city: { equals: query.city, mode: 'insensitive' } };
    }
    if (query.operation) {
      where.operation = query.operation;
    }
    if (query.currency) {
      where.currency = query.currency;
    }
    if (query.min_price !== undefined || query.max_price !== undefined) {
      where.price = {
        ...(query.min_price !== undefined ? { gte: query.min_price } : {}),
        ...(query.max_price !== undefined ? { lte: query.max_price } : {}),
      };
    }
    if (query.bedrooms !== undefined) {
      where.bedrooms = { gte: query.bedrooms };
    }
    if (query.bathrooms !== undefined) {
      where.bathrooms = { gte: query.bathrooms };
    }
    // Radius-based geo filter (preferred) or bounding box fallback
    let geoFilter: any = null;
    if (query.lat !== undefined && query.lng !== undefined && query.radius_km !== undefined) {
      // Convert radius to bounding box approximation
      const kmPerDegreeLat = 111.32;
      const kmPerDegreeLng = 111.32 * Math.cos((query.lat * Math.PI) / 180);
      const dLat = query.radius_km / kmPerDegreeLat;
      const dLng = query.radius_km / kmPerDegreeLng;
      geoFilter = {
        OR: [
          {
            latitude: { gte: query.lat - dLat, lte: query.lat + dLat },
            longitude: { gte: query.lng - dLng, lte: query.lng + dLng },
          },
          { latitude: null },
        ],
      };
    } else if (
      query.min_lat !== undefined &&
      query.max_lat !== undefined &&
      query.min_lng !== undefined &&
      query.max_lng !== undefined
    ) {
      geoFilter = {
        OR: [
          {
            latitude: { gte: query.min_lat, lte: query.max_lat },
            longitude: { gte: query.min_lng, lte: query.max_lng },
          },
          { latitude: null },
        ],
      };
    }
    if (geoFilter) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), geoFilter];
    }
    return where;
  }

  private buildOrderBy(
    sort: string,
  ): Prisma.propertiesOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ price: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }];
      case 'recent':
      default:
        return [{ published_at: 'desc' }, { created_at: 'desc' }];
    }
  }

  /** Devuelve coordenadas: las del DTO o, si falta alguna, geocodificando la dirección. */
  private async resolveCoordinates(dto: {
    latitude?: number;
    longitude?: number;
    address?: string;
    zone_id?: string;
  }): Promise<{ latitude?: number; longitude?: number }> {
    if (dto.latitude != null && dto.longitude != null) {
      return { latitude: dto.latitude, longitude: dto.longitude };
    }
    if (!dto.address) {
      return { latitude: dto.latitude, longitude: dto.longitude };
    }
    let city: string | undefined;
    if (dto.zone_id) {
      const zone = await this.prisma.zones.findUnique({
        where: { id: dto.zone_id },
      });
      city = zone?.city;
    }
    const geo = await this.geocoding.geocode(dto.address, city);
    if (geo) {
      return { latitude: geo.latitude, longitude: geo.longitude };
    }
    return { latitude: dto.latitude, longitude: dto.longitude };
  }

  /**
   * Listado público con búsqueda full-text sobre `search_vector` (índice GIN)
   * y orden por relevancia (ts_rank). Usa SQL crudo porque el tsvector no está
   * expuesto en el cliente Prisma.
   */
  private async findPublicFullText(query: QueryPropertiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q!.trim();

    // Resolver filtros con join a IDs escalares para evitar joins en el SQL.
    let typeId: string | undefined;
    if (query.type) {
      const type = await this.prisma.property_types.findFirst({
        where: { slug: { equals: query.type, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!type) return this.emptyPage(page, limit);
      typeId = type.id;
    }
    let zoneIds: string[] | undefined;
    if (query.city) {
      const zones = await this.prisma.zones.findMany({
        where: { city: { equals: query.city, mode: 'insensitive' } },
        select: { id: true },
      });
      if (zones.length === 0) return this.emptyPage(page, limit);
      zoneIds = zones.map((z) => z.id);
    }

    const tsquery = Prisma.sql`websearch_to_tsquery('spanish', ${q})`;
    const conditions: Prisma.Sql[] = [
      Prisma.sql`status = 'published'`,
      Prisma.sql`approval_status = 'approved'`,
      Prisma.sql`search_vector @@ ${tsquery}`,
    ];
    if (typeId) conditions.push(Prisma.sql`property_type_id = ${typeId}::uuid`);
    if (query.zone_id)
      conditions.push(Prisma.sql`zone_id = ${query.zone_id}::uuid`);
    if (zoneIds) conditions.push(Prisma.sql`zone_id = ANY(${zoneIds}::uuid[])`);
    if (query.operation)
      conditions.push(
        Prisma.sql`operation = ${query.operation}::property_operation`,
      );
    if (query.currency) conditions.push(Prisma.sql`currency = ${query.currency}`);
    if (query.min_price !== undefined)
      conditions.push(Prisma.sql`price >= ${query.min_price}`);
    if (query.max_price !== undefined)
      conditions.push(Prisma.sql`price <= ${query.max_price}`);
    if (query.bedrooms !== undefined)
      conditions.push(Prisma.sql`bedrooms >= ${query.bedrooms}`);
    if (query.bathrooms !== undefined)
      conditions.push(Prisma.sql`bathrooms >= ${query.bathrooms}`);
    if (query.lat !== undefined && query.lng !== undefined && query.radius_km !== undefined) {
      const kmPerDegreeLat = 111.32;
      const kmPerDegreeLng = 111.32 * Math.cos((query.lat * Math.PI) / 180);
      const dLat = query.radius_km / kmPerDegreeLat;
      const dLng = query.radius_km / kmPerDegreeLng;
      conditions.push(
        Prisma.sql`(latitude BETWEEN ${query.lat - dLat} AND ${query.lat + dLat} AND longitude BETWEEN ${query.lng - dLng} AND ${query.lng + dLng} OR latitude IS NULL)`,
      );
    } else {
      if (query.min_lat !== undefined && query.max_lat !== undefined)
        conditions.push(
          Prisma.sql`(latitude BETWEEN ${query.min_lat} AND ${query.max_lat} OR latitude IS NULL)`,
        );
      if (query.min_lng !== undefined && query.max_lng !== undefined)
        conditions.push(
          Prisma.sql`(longitude BETWEEN ${query.min_lng} AND ${query.max_lng} OR longitude IS NULL)`,
        );
    }

    const whereSql = Prisma.join(conditions, ' AND ');
    const orderSql =
      query.sort === 'price_asc'
        ? Prisma.sql`price ASC`
        : query.sort === 'price_desc'
          ? Prisma.sql`price DESC`
          : query.sort === 'recent'
            ? Prisma.sql`published_at DESC NULLS LAST`
            : Prisma.sql`ts_rank(search_vector, ${tsquery}) DESC, published_at DESC NULLS LAST`;

    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM properties WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
    );
    const countRows = await this.prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`SELECT count(*)::int AS count FROM properties WHERE ${whereSql}`,
    );
    const total = Number(countRows[0]?.count ?? 0);
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return this.emptyPage(page, limit, total);

    const items = await this.prisma.properties.findMany({
      where: { id: { in: ids } },
      include: listInclude,
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    const data = ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  private emptyPage(page: number, limit: number, total = 0) {
    return {
      data: [],
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  private async assertTypeAndZone(typeId?: string, zoneId?: string) {
    if (typeId) {
      const type = await this.prisma.property_types.findUnique({
        where: { id: typeId },
      });
      if (!type || !type.is_active) {
        throw new BadRequestException('Tipo de propiedad inválido o inactivo');
      }
    }
    if (zoneId) {
      const zone = await this.prisma.zones.findUnique({ where: { id: zoneId } });
      if (!zone) {
        throw new BadRequestException('Zona inválida');
      }
    }
  }

  private async findOrThrow(id: string) {
    const prop = await this.prisma.properties.findUnique({ where: { id } });
    if (!prop) {
      throw new NotFoundException('Propiedad no encontrada');
    }
    return prop;
  }

  private async getOwnedOrThrow(user: AuthUser, id: string) {
    const prop = await this.findOrThrow(id);
    if (prop.owner_id !== user.id && !this.isAdmin(user)) {
      throw new ForbiddenException('No tienes permiso sobre esta propiedad');
    }
    return prop;
  }

  private isAdmin(user?: AuthUser): boolean {
    return !!user && user.roles.includes('admin');
  }

  private async requireApproval(): Promise<boolean> {
    const setting = await this.prisma.settings.findUnique({
      where: { key: 'properties.require_approval' },
    });
    if (!setting) {
      return true;
    }
    return setting.value === true;
  }
}
