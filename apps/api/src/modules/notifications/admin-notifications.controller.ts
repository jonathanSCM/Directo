import { Body, Controller, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { BroadcastDto } from './dto/broadcast.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('broadcast')
  @ApiOperation({ summary: 'Enviar notificación masiva (publicidad/anuncio)' })
  broadcast(@Body() dto: BroadcastDto) {
    return this.notificationsService.broadcast(dto);
  }

  @Post('subscription-reminders')
  @ApiOperation({ summary: 'Generar recordatorios de suscripción por vencer' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  reminders(@Query('days') days?: string) {
    return this.notificationsService.sendExpiringReminders(
      days ? Number(days) : 5,
    );
  }
}
