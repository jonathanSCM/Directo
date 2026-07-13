import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List all support conversations (reports)' })
  async listTickets(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const tickets = await this.prisma.support_conversations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        users: { select: { id: true, name: true, email: true, phone: true } },
        properties: { select: { id: true, title: true, slug: true } },
        support_messages: { orderBy: { created_at: 'asc' } },
      },
    });
    return tickets;
  }

  @Get('visit-requests')
  @ApiOperation({ summary: 'List all visit requests' })
  async listVisitRequests(
    @Query('status') status?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.visit_requests.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        users_visit_requests_user_idTousers: {
          select: { id: true, name: true, email: true, phone: true },
        },
        users_visit_requests_owner_idTousers: {
          select: { id: true, name: true, email: true, phone: true },
        },
        properties: { select: { id: true, title: true, slug: true } },
      },
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Support stats overview' })
  async stats() {
    const [totalTickets, activeTickets, totalVisits, pendingVisits] =
      await Promise.all([
        this.prisma.support_conversations.count(),
        this.prisma.support_conversations.count({ where: { status: 'active' } }),
        this.prisma.visit_requests.count(),
        this.prisma.visit_requests.count({ where: { status: 'pending' } }),
      ]);

    return { totalTickets, activeTickets, totalVisits, pendingVisits };
  }

  @Patch('tickets/:id/resolve')
  @ApiOperation({ summary: 'Resolve a support ticket' })
  async resolveTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.support_conversations.update({
      where: { id },
      data: { status: 'resolved', updated_at: new Date() },
    });
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Admin reply to a support ticket' })
  async replyToTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
  ) {
    await this.prisma.support_conversations.update({
      where: { id },
      data: { updated_at: new Date() },
    });
    return this.prisma.support_messages.create({
      data: {
        conversation_id: id,
        sender: 'admin',
        content: body.content,
      },
    });
  }

  @Get('tickets/:id/messages')
  @ApiOperation({ summary: 'Get all messages for a ticket' })
  async getTicketMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.support_messages.findMany({
      where: { conversation_id: id },
      orderBy: { created_at: 'asc' },
    });
  }
}
