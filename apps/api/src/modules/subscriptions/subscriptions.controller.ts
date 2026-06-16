import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mi suscripción actual' })
  me(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getMine(userId);
  }

  @Post('activate')
  @ApiOperation({ summary: 'Contratar un plan' })
  activate(
    @CurrentUser('id') userId: string,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.subscriptionsService.activate(userId, dto.plan_id);
  }

  @Post('renew')
  @ApiOperation({ summary: 'Renovar mi suscripción' })
  renew(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.renew(userId);
  }

  @Post('free-trial')
  @ApiOperation({ summary: 'Activar prueba gratuita 30 días (una vez por propietario)' })
  freeTrial(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.claimFreeTrial(userId);
  }

  @Get('free-trial/status')
  @ApiOperation({ summary: 'Verificar si ya usó la prueba gratuita' })
  freeTrialStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.hasUsedFreeTrial(userId).then((used) => ({ used }));
  }
}
