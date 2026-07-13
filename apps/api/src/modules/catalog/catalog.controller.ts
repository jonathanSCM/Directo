import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('property-types')
  @ApiOperation({ summary: 'Listar tipos de propiedad activos' })
  propertyTypes() {
    return this.catalogService.listPropertyTypes();
  }

  @Public()
  @Get('zones')
  @ApiOperation({ summary: 'Listar zonas activas (opcionalmente por ciudad)' })
  @ApiQuery({ name: 'city', required: false })
  zones(@Query('city') city?: string) {
    return this.catalogService.listZones(city);
  }

  @Public()
  @Get('amenities')
  @ApiOperation({ summary: 'Listar amenidades activas' })
  amenities() {
    return this.catalogService.listAmenities();
  }
}
