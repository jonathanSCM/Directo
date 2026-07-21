import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateQrSettingsDto } from './dto/update-qr-settings.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaymentsService } from './payments.service';
import { qrImageMulterOptions } from './qr-image-multer.config';

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

  @Get('qr-settings')
  @ApiOperation({ summary: 'Ver configuración del QR bancario' })
  getQrSettings() {
    return this.paymentsService.getQrSettings();
  }

  @Put('qr-settings')
  @UseInterceptors(FileInterceptor('qr_image', qrImageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        qr_image: { type: 'string', format: 'binary' },
        bank_name: { type: 'string' },
        account_holder: { type: 'string' },
        account_number: { type: 'string' },
        instructions: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Configurar el QR bancario real y datos de cuenta' })
  updateQrSettings(
    @Body() dto: UpdateQrSettingsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.paymentsService.updateQrSettings(dto, file);
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
