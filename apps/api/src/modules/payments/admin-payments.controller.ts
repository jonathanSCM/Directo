import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pagos (filtros)' })
  list(@Query() query: PaymentsQueryDto) {
    return this.paymentsService.adminList(query);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirmar pago (activa la suscripción)' })
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.confirm(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar pago' })
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.reject(id);
  }
}
