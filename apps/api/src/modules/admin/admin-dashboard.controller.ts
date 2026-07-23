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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas del dashboard administrativo' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar/buscar usuarios (admin)' })
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalle de usuario con propiedades, suscripciones y pagos' })
  getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspender usuario' })
  suspend(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.suspendUser(adminId, id, dto.reason);
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Reactivar usuario' })
  activate(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.activateUser(adminId, id);
  }

  @Patch('users/:id/verify')
  @ApiOperation({ summary: 'Marcar/desmarcar usuario como verificado' })
  setVerified(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('is_verified') isVerified: boolean,
  ) {
    return this.adminService.setUserVerified(id, isVerified);
  }
}
