import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { avatarMulterOptions } from './avatar-multer.config';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener el perfil propio' })
  findMe(@CurrentUser('id') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar datos del perfil propio' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Subir/cambiar la foto de perfil' })
  updateAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(userId, avatar);
  }

  @Post('me/push-token')
  @ApiOperation({ summary: 'Registrar el token de push (Expo) de este dispositivo' })
  registerPushToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.usersService.registerPushToken(userId, dto);
  }

  @Delete('me/push-token')
  @ApiOperation({ summary: 'Dar de baja el token de push de este dispositivo (ej. al cerrar sesión)' })
  unregisterPushToken(@Body() dto: RegisterPushTokenDto) {
    return this.usersService.unregisterPushToken(dto.token);
  }
}
