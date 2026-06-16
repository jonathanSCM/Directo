import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminLogsQueryDto } from './dto/admin-logs-query.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/logs')
export class AdminLogsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de acciones administrativas' })
  list(@Query() query: AdminLogsQueryDto) {
    return this.adminService.listLogs(query);
  }
}
