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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { imageMulterOptions } from '../properties/multer.config';
import { AdsService } from './ads.service';
import { AdminCreateAdDto, AdminUpdateAdDto, CreateAdDto, CreateCompanyDto } from './dto/ads.dto';

@ApiTags('ads')
@Controller()
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // ── Público ─────────────────────────────────────────────────────────────────

  @Public()
  @Get('ads/serve')
  @ApiOperation({ summary: 'Anuncios a mostrar (banners de marca cargados por el admin)' })
  serve(
    @Query('count') count?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('placement') placement?: 'banner' | 'popup',
  ) {
    return this.adsService.serve(
      count ? parseInt(count, 10) : 1,
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      placement === 'popup' ? 'popup' : 'banner',
    );
  }

  // ── Empresa (dueño) ─────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Post('companies')
  @ApiOperation({ summary: 'Crear/actualizar mi empresa (requiere plan Empresas)' })
  createCompany(@CurrentUser('id') userId: string, @Body() dto: CreateCompanyDto) {
    return this.adsService.createCompany(userId, dto);
  }

  @ApiBearerAuth()
  @Get('companies/mine')
  @ApiOperation({ summary: 'Mi empresa y sus anuncios' })
  myCompany(@CurrentUser('id') userId: string) {
    return this.adsService.myCompany(userId);
  }

  @ApiBearerAuth()
  @Post('companies/mine/ads')
  @ApiOperation({ summary: 'Crear anuncio (imagen + título + link)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  createAd(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAdDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adsService.createAd(userId, dto, file);
  }

  @ApiBearerAuth()
  @Patch('companies/mine/ads/:id/status')
  @ApiOperation({ summary: 'Pausar/activar mi anuncio' })
  setStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'active' | 'paused' },
  ) {
    return this.adsService.setAdStatus(userId, id, body.status);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Roles('admin')
  @Get('admin/ads')
  @ApiOperation({ summary: 'Listar todos los anuncios (admin)' })
  adminList() {
    return this.adsService.adminList();
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Patch('admin/ads/:id/status')
  @ApiOperation({ summary: 'Pausar/activar un anuncio (admin)' })
  adminSetStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'active' | 'paused' },
  ) {
    return this.adsService.adminSetStatus(id, body.status);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('admin/ads')
  @ApiOperation({ summary: 'Cargar un banner de marca (publicidad "casa", sin empresa externa)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  adminCreateAd(@Body() dto: AdminCreateAdDto, @UploadedFile() file: Express.Multer.File) {
    return this.adsService.adminCreateAd(dto, file);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Patch('admin/ads/:id')
  @ApiOperation({ summary: 'Editar título/link/vencimiento/estado/imagen de un anuncio (admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  adminUpdateAd(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateAdDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsService.adminUpdateAd(id, dto, file);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Delete('admin/ads/:id')
  @ApiOperation({ summary: 'Eliminar un anuncio (admin)' })
  adminDeleteAd(@Param('id', ParseUUIDPipe) id: string) {
    return this.adsService.adminDeleteAd(id);
  }
}
