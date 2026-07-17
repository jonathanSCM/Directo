import {
  Body,
  Controller,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
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
import { CreateAdDto, CreateCompanyDto } from './dto/ads.dto';

@ApiTags('ads')
@Controller()
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // ── Público ─────────────────────────────────────────────────────────────────

  @Public()
  @Get('ads/serve')
  @ApiOperation({
    summary: 'Anuncios elegibles (descuenta una vista c/u); prioriza por zona si se envía lat/lng',
  })
  serve(
    @Query('count', new ParseIntPipe({ optional: true })) count?: number,
    @Query('lat', new ParseFloatPipe({ optional: true })) lat?: number,
    @Query('lng', new ParseFloatPipe({ optional: true })) lng?: number,
  ) {
    return this.adsService.serve(count ?? 1, lat, lng);
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
}
