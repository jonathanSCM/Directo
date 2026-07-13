import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { CreatePropertyDto } from './dto/create-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar propiedades publicadas (con filtros)' })
  list(@Query() query: QueryPropertiesDto) {
    return this.propertiesService.findPublic(query);
  }

  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({ summary: 'Mis propiedades (cualquier estado)' })
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryPropertiesDto) {
    return this.propertiesService.findMine(user, query.page ?? 1, query.limit ?? 20);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear una propiedad (modo propietario)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(user, dto);
  }

  @ApiBearerAuth()
  @Get('by-id/:id')
  @ApiOperation({ summary: 'Detalle de una propiedad por ID (dueño)' })
  findById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.propertiesService.findById(user, id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle de una propiedad por slug' })
  detail(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | null,
    @Query('track_view') trackView?: string,
  ) {
    return this.propertiesService.findBySlug(slug, user ?? undefined, trackView === 'true');
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar una propiedad' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(user, id, dto);
  }

  @ApiBearerAuth()
  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publicar / enviar a revisión' })
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.publish(user, id);
  }

  @ApiBearerAuth()
  @Patch(':id/unpublish')
  @ApiOperation({ summary: 'Pausar una publicación' })
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.unpublish(user, id);
  }

  @ApiBearerAuth()
  @Patch(':id/sold')
  @ApiOperation({ summary: 'Marcar como vendida / alquilada' })
  markSold(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.markSold(user, id);
  }

  @ApiBearerAuth()
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Republicar propiedad vendida/alquilada o pausada' })
  reactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.reactivate(user, id);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Dar de baja una publicación' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.remove(user, id);
  }
}
