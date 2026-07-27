import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('properties/:id/report')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Reportar una propiedad (falsa, engañosa, etc.)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(user.id, propertyId, dto);
  }
}
