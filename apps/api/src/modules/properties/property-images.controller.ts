import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { imageMulterOptions } from './multer.config';
import { PropertyImagesService } from './property-images.service';

@ApiTags('property-images')
@ApiBearerAuth()
@Controller('properties/:propertyId/images')
export class PropertyImagesController {
  constructor(private readonly imagesService: PropertyImagesService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Subir imágenes (múltiples)' })
  upload(
    @CurrentUser() user: AuthUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imagesService.addImages(user, propertyId, files);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reordenar imágenes' })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.imagesService.reorder(user, propertyId, dto.imageIds);
  }

  @Patch(':imageId/main')
  @ApiOperation({ summary: 'Marcar imagen como principal' })
  setMain(
    @CurrentUser() user: AuthUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.imagesService.setMain(user, propertyId, imageId);
  }

  @Delete(':imageId')
  @ApiOperation({ summary: 'Eliminar imagen' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.imagesService.remove(user, propertyId, imageId);
  }
}
