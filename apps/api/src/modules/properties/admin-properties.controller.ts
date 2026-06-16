import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { RejectPropertyDto } from './dto/reject-property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('admin/properties')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/properties')
export class AdminPropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las propiedades (admin)' })
  list(@Query() query: QueryPropertiesDto) {
    return this.propertiesService.adminList(query);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Aprobar publicación' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.adminApprove(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar publicación' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPropertyDto,
  ) {
    return this.propertiesService.adminReject(id, dto.reason);
  }

  @Patch(':id/take-down')
  @ApiOperation({ summary: 'Dar de baja publicación' })
  takeDown(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.adminTakeDown(id);
  }
}
