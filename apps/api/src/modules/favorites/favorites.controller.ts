import { Controller, Post, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Post(':propertyId')
  @ApiOperation({ summary: 'Toggle favorite (add/remove)' })
  toggle(
    @CurrentUser() user: AuthUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.svc.toggle(user.id, propertyId);
  }

  @Get()
  @ApiOperation({ summary: 'List saved properties with details' })
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.id);
  }

  @Get('ids')
  @ApiOperation({ summary: 'List saved property IDs only' })
  listIds(@CurrentUser() user: AuthUser) {
    return this.svc.listIds(user.id);
  }

  @Get('check/:propertyId')
  @ApiOperation({ summary: 'Check if a property is saved' })
  async check(
    @CurrentUser() user: AuthUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return { saved: await this.svc.isSaved(user.id, propertyId) };
  }
}
