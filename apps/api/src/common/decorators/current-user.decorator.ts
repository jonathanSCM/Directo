import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../modules/auth/types/jwt-payload.interface';

/**
 * Inyecta el usuario autenticado (poblado por JwtStrategy).
 * Uso: `@CurrentUser() user: AuthUser` o `@CurrentUser('id') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    return data ? user?.[data] : user;
  },
);
