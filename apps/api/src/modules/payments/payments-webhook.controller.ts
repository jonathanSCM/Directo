import {
  Body,
  Controller,
  Headers,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiExcludeController()
@Controller('payments/webhook')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post(':provider')
  async handle(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, unknown>,
    @Body() payload: Record<string, unknown>,
  ) {
    this.logger.log(`Webhook recibido de provider=${provider}`);
    await this.paymentsService.handleWebhook(provider, payload, headers);
    return { received: true };
  }
}
