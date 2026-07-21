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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAssignSubscriptionDto } from './dto/admin-assign-subscription.dto';
import { UpdatePropertyCountDto } from './dto/update-property-count.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar suscripciones (admin)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'user_id', required: false })
  list(@Query('status') status?: string, @Query('user_id') userId?: string) {
    return this.subscriptionsService.adminList(status, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Asignar suscripción a un usuario (admin)' })
  assign(@Body() dto: AdminAssignSubscriptionDto) {
    return this.subscriptionsService.adminAssign(dto.user_id, dto.plan_id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activar suscripción manualmente' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.activateSubscription(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar suscripción' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.cancel(id);
  }

  @Patch(':id/property-count')
  @ApiOperation({
    summary:
      'Corregir el cupo de propiedades de una suscripción existente (no cambia solo por editar el plan)',
  })
  updatePropertyCount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyCountDto,
  ) {
    return this.subscriptionsService.adminUpdatePropertyCount(
      id,
      dto.property_count,
    );
  }
}
