import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('subscriptions')
@Controller()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get('subscription-plans')
  @ApiOperation({ summary: 'Listar planes activos' })
  list() {
    return this.plansService.list(true);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Get('admin/subscription-plans')
  @ApiOperation({ summary: 'Listar todos los planes (admin)' })
  adminList() {
    return this.plansService.list(false);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('admin/subscription-plans')
  @ApiOperation({ summary: 'Crear un plan' })
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Patch('admin/subscription-plans/:id')
  @ApiOperation({ summary: 'Editar un plan' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Delete('admin/subscription-plans/:id')
  @ApiOperation({ summary: 'Eliminar / desactivar un plan' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.remove(id);
  }
}
