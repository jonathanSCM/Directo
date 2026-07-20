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

  /**
   * Un solo hilo por propietario (no un ticket nuevo por solicitud). Si no
   * existe, se crea con un saludo inicial del asistente.
   */
  async getOrCreateAdvisorThread(userId: string) {
    let conv = await this.prisma.support_conversations.findFirst({
      where: { user_id: userId, type: 'advisor_request' },
      orderBy: { created_at: 'asc' },
    });
    if (!conv) {
      conv = await this.startConversation(userId, 'advisor_request');
      await this.addMessage(conv.id, 'bot', ADVISOR_GREETING, 'greeting');
    }
    const messages = await this.prisma.support_messages.findMany({
      where: { conversation_id: conv.id },
      orderBy: { created_at: 'asc' },
    });
    return { conversation: conv, messages };
  }

  /**
   * Envía un mensaje del propietario al asistente. Lógica pura (regex, sin
   * IA): reconoce la intención, recuerda lo ya sabido (metadata del hilo) y
   * responde en consecuencia. Solo notifica a los admins la primera vez que
   * detecta qué necesita el propietario, para no saturarlos.
   */
  async sendAdvisorMessage(userId: string, content: string) {
    const { conversation } = await this.getOrCreateAdvisorThread(userId);

    if (conversation.status !== 'active') {
      await this.prisma.support_conversations.update({
        where: { id: conversation.id },
        data: { status: 'active' },
      });
      conversation.status = 'active';
    }
    await this.addMessage(conversation.id, 'user', content);

    const intent = parseOwnerIntent(content);
    const meta: Record<string, any> = { ...(conversation.metadata as any) };
    let needJustSet = false;

    if (!meta.need && OWNER_NEED_INTENTS.includes(intent)) {
      meta.need = intent;
      needJustSet = true;
      if (intent === 'other') meta.details = content;
    } else if (meta.need && intent !== 'greeting' && intent !== 'thanks') {
      meta.details = [meta.details, content].filter(Boolean).join('\n');
    }

    const botReply = buildAdvisorBotReply(intent, meta, needJustSet);
    await this.addMessage(conversation.id, 'bot', botReply);

    if (needJustSet) {
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, phone: true },
      });
      meta.contact_name = user?.name ?? null;
      meta.contact_phone = user?.phone ?? null;

      const admins = await this.prisma.user_roles.findMany({
        where: { roles: { name: 'admin' } },
        select: { user_id: true },
      });
      const needLabel = ADVISOR_NEED_LABELS[intent] ?? intent;
      for (const admin of admins) {
        await this.prisma.notifications.create({
          data: {
            user_id: admin.user_id,
            type: 'system',
            title: 'Nueva solicitud de asesor',
            message: `${user?.name} necesita ayuda: ${needLabel}`,
            data: { conversation_id: conversation.id },
          },
        });
      }
    }

    await this.prisma.support_conversations.update({
      where: { id: conversation.id },
      data: { metadata: meta, updated_at: new Date() },
    });

    const messages = await this.prisma.support_messages.findMany({
      where: { conversation_id: conversation.id },
      orderBy: { created_at: 'asc' },
    });
    return { conversation: { ...conversation, metadata: meta }, messages };
  }
}

const ADVISOR_NEED_LABELS: Record<string, string> = {
  sell: 'Vender su propiedad',
  rent: 'Alquilar su propiedad',
  anticretico: 'Poner en anticrético',
  full_service: 'No tiene tiempo, quiere que le gestionen todo',
  other: 'Otro',
};

const OWNER_NEED_INTENTS = ['sell', 'rent', 'anticretico', 'full_service', 'other'];

const ADVISOR_GREETING =
  '¡Hola! Soy el asistente de DIRECTO. ¿En qué te ayudamos con tu propiedad? ' +
  'Puedes contarme si quieres venderla, alquilarla, ponerla en anticrético, ' +
  'o si simplemente no tienes tiempo y quieres que gestionemos todo por ti.';

const SELL_WORDS = /\b(vender|venta|vendo|se vende)\b/i;
const RENT_WORDS = /\b(alquilar|alquiler|alquilo|arrendar|arriendo|rentar|renta)\b/i;
const ANTICRETICO_WORDS = /\b(anticr[eé]tico|anticresis)\b/i;
const FULL_SERVICE_WORDS = /\b(no tengo tiempo|no tengo el tiempo|que se encargue|que gestionen|gest[ií]onen|h[aá]ganlo|todo ustedes|se encarguen|ayuda con todo)\b/i;
const GREETING_WORDS = /^\s*(hola|buenas|hey|qu[eé] tal|buenos d[ií]as|buenas tardes|buenas noches)\b/i;
const THANKS_WORDS = /^\s*(gracias|muchas gracias|listo|ok|okay|perfecto|dale)\b/i;

function parseOwnerIntent(text: string): string {
  const t = text.toLowerCase();
  if (GREETING_WORDS.test(t)) return 'greeting';
  if (THANKS_WORDS.test(t)) return 'thanks';
  if (FULL_SERVICE_WORDS.test(t)) return 'full_service';
  if (ANTICRETICO_WORDS.test(t)) return 'anticretico';
  if (RENT_WORDS.test(t)) return 'rent';
  if (SELL_WORDS.test(t)) return 'sell';
  return 'other';
}

function buildAdvisorBotReply(intent: string, meta: Record<string, any>, needJustSet: boolean): string {
  if (intent === 'greeting' && !meta.need) return ADVISOR_GREETING;
  if (intent === 'greeting' && meta.need) {
    const label = (ADVISOR_NEED_LABELS[meta.need] ?? 'tu solicitud').toLowerCase();
    return `¡Hola de nuevo! ¿En qué más puedo ayudarte? Ya avisé a un asesor sobre ${label} — si todavía no te contactó por WhatsApp, te va a escribir pronto.`;
  }
  if (intent === 'thanks') return '¡De nada! Un asesor te va a contactar por WhatsApp pronto. Si quieres agregar algo más, aquí estoy.';
  if (needJustSet) {
    const label = ADVISOR_NEED_LABELS[intent] ?? 'tu solicitud';
    return `Perfecto, anoté: ${label}. Ya avisé a un asesor de DIRECTO, te va a contactar por WhatsApp pronto. Si quieres, cuéntame más detalles de tu propiedad mientras tanto.`;
  }
  return 'Gracias, tomo nota de eso también. ¿Necesitas algo más mientras te contacta el asesor?';
}
