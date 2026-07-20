import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async startConversation(
    userId: string,
    type: 'visit' | 'info_request' | 'report' | 'faq' | 'advisor_request',
    propertyId?: string,
  ) {
    const conv = await this.prisma.support_conversations.create({
      data: {
        user_id: userId,
        property_id: propertyId ?? null,
        type,
        status: 'active',
      },
    });
    return conv;
  }

  async addMessage(
    conversationId: string,
    sender: 'user' | 'bot',
    content: string,
    nodeId?: string,
    options?: any[],
  ) {
    return this.prisma.support_messages.create({
      data: {
        conversation_id: conversationId,
        sender,
        content,
        node_id: nodeId ?? null,
        options: options ?? undefined,
      },
    });
  }

  async getConversations(userId: string) {
    return this.prisma.support_conversations.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        properties: { select: { id: true, title: true, slug: true } },
        support_messages: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });
  }

  async getMessages(userId: string, conversationId: string) {
    const conv = await this.prisma.support_conversations.findFirst({
      where: { id: conversationId, user_id: userId },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const messages = await this.prisma.support_messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    });
    return { conversation: conv, messages };
  }

  async resolveConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.support_conversations.findFirst({
      where: { id: conversationId, user_id: userId },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    return this.prisma.support_conversations.update({
      where: { id: conversationId },
      data: { status: 'resolved', updated_at: new Date() },
    });
  }

  async createVisitRequest(
    userId: string,
    propertyId: string,
    preferredDate: string,
    preferredTime: string,
    message?: string,
  ) {
    const [property, buyer] = await Promise.all([
      this.prisma.properties.findUnique({
        where: { id: propertyId },
        select: { id: true, owner_id: true, title: true, slug: true },
      }),
      this.prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    if (!buyer) throw new NotFoundException('Usuario no encontrado');
    if (property.owner_id === userId)
      throw new BadRequestException('No puedes agendar visita a tu propia propiedad');

    const existing = await this.prisma.visit_requests.findFirst({
      where: {
        user_id: userId,
        property_id: propertyId,
        status: 'pending',
      },
    });
    if (existing)
      throw new BadRequestException('Ya tienes una solicitud pendiente para esta propiedad');

    const visit = await this.prisma.visit_requests.create({
      data: {
        user_id: userId,
        property_id: propertyId,
        owner_id: property.owner_id,
        preferred_date: new Date(preferredDate),
        preferred_time: preferredTime,
        message: message ?? null,
      },
    });

    await this.prisma.notifications.create({
      data: {
        user_id: property.owner_id,
        type: 'visit_request_received',
        title: 'Nueva solicitud de visita',
        message: `${buyer.name} quiere visitar "${property.title}" el ${preferredDate} a las ${preferredTime}`,
        data: {
          visit_request_id: visit.id,
          property_id: propertyId,
          property_slug: property.slug,
          buyer_id: buyer.id,
          buyer_name: buyer.name,
          buyer_email: buyer.email,
          buyer_phone: buyer.phone,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          visitor_message: message ?? null,
        },
      },
    });

    return visit;
  }

  async getVisitRequests(userId: string, role: 'buyer' | 'owner') {
    const where = role === 'owner'
      ? { owner_id: userId }
      : { user_id: userId };

    return this.prisma.visit_requests.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        properties: { select: { id: true, title: true, slug: true } },
        users_visit_requests_user_idTousers: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async updateVisitStatus(
    ownerId: string,
    visitId: string,
    status: 'confirmed' | 'rejected',
  ) {
    const visit = await this.prisma.visit_requests.findFirst({
      where: { id: visitId, owner_id: ownerId },
      include: { properties: { select: { title: true } } },
    });
    if (!visit) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.visit_requests.update({
      where: { id: visitId },
      data: { status, updated_at: new Date() },
    });

    const statusLabel = status === 'confirmed' ? 'confirmada' : 'rechazada';
    await this.prisma.notifications.create({
      data: {
        user_id: visit.user_id,
        type: 'visit_request_updated',
        title: `Visita ${statusLabel}`,
        message: `Tu solicitud de visita a "${visit.properties.title}" fue ${statusLabel}`,
        data: { visit_request_id: visitId },
      },
    });

    return updated;
  }

  async getActiveRequests(userId: string, propertyId: string) {
    return this.prisma.visit_requests.findMany({
      where: {
        user_id: userId,
        property_id: propertyId,
        status: { in: ['pending', 'confirmed'] },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createReport(
    userId: string,
    propertyId: string,
    reportType: string,
    description: string,
  ) {
    const property = await this.prisma.properties.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    const conv = await this.startConversation(userId, 'report', propertyId);

    await this.addMessage(conv.id, 'user', `Reporte: ${reportType}\n${description}`, 'report_submitted');

    await this.prisma.support_conversations.update({
      where: { id: conv.id },
      data: {
        status: 'resolved',
        metadata: { report_type: reportType, description },
        updated_at: new Date(),
      },
    });

    const admins = await this.prisma.user_roles.findMany({
      where: { roles: { name: 'admin' } },
      select: { user_id: true },
    });

    for (const admin of admins) {
      await this.prisma.notifications.create({
        data: {
          user_id: admin.user_id,
          type: 'system',
          title: 'Nuevo reporte de propiedad',
          message: `Reporte "${reportType}" sobre "${property.title}"`,
          data: { conversation_id: conv.id, property_id: propertyId },
        },
      });
    }

    return conv;
  }

  async createAdvisorRequest(userId: string, data: { need: string; details?: string }) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, email: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const needLabel = ADVISOR_NEED_LABELS[data.need] ?? data.need;
    const created = await this.startConversation(userId, 'advisor_request');

    // El contacto se toma del perfil, no se le pide al usuario en el formulario.
    const conv = await this.prisma.support_conversations.update({
      where: { id: created.id },
      data: {
        metadata: {
          need: data.need,
          details: data.details ?? null,
          contact_name: user.name,
          contact_phone: user.phone,
        },
      },
    });

    const summary = [
      `Solicita ayuda de un asesor: ${needLabel}`,
      data.details ? `Detalle: ${data.details}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    await this.addMessage(conv.id, 'user', summary, 'advisor_request_submitted');

    const admins = await this.prisma.user_roles.findMany({
      where: { roles: { name: 'admin' } },
      select: { user_id: true },
    });
    for (const admin of admins) {
      await this.prisma.notifications.create({
        data: {
          user_id: admin.user_id,
          type: 'system',
          title: 'Nueva solicitud de asesor',
          message: `${user.name} necesita ayuda: ${needLabel}`,
          data: { conversation_id: conv.id },
        },
      });
    }

    return conv;
  }
}

const ADVISOR_NEED_LABELS: Record<string, string> = {
  sell: 'Vender su propiedad',
  rent: 'Alquilar su propiedad',
  anticretico: 'Poner en anticrético',
  full_service: 'No tiene tiempo, quiere que le gestionen todo',
  other: 'Otro',
};
