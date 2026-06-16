import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { proofMulterOptions } from './proof-multer.config';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear una orden de pago' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(userId, dto);
  }

  @Post(':id/upload-proof')
  @UseInterceptors(FileInterceptor('proof', proofMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { proof: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Subir comprobante (QR / manual)' })
  uploadProof(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() proof: Express.Multer.File,
  ) {
    return this.paymentsService.uploadProof(userId, id, proof);
  }

  @Get('me')
  @ApiOperation({ summary: 'Historial de mis pagos' })
  mine(@CurrentUser('id') userId: string) {
    return this.paymentsService.listMine(userId);
  }
}
