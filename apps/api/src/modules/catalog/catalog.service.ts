import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listPropertyTypes(includeInactive = false) {
    return this.prisma.property_types.findMany({
      where: includeInactive ? undefined : { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  listZones(city?: string, includeInactive = false) {
    return this.prisma.zones.findMany({
      where: {
        ...(includeInactive ? {} : { is_active: true }),
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });
  }
}
