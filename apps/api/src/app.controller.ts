import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check del servicio' })
  health() {
    return {
      status: 'ok',
      service: 'inmobiliaria-api',
      timestamp: new Date().toISOString(),
    };
  }
}
