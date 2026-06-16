export type RoleMode = 'buyer' | 'owner';

/** Payload del access token JWT. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  active_role: RoleMode;
  roles: string[];
}

/** Usuario autenticado expuesto en `request.user`. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  active_role: RoleMode;
  status: string;
  roles: string[];
}

/** Contexto de la petición para auditar la sesión. */
export interface SessionContext {
  ua?: string;
  ip?: string;
}
