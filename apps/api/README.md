# API — Inmobiliaria MVP (NestJS)

Backend REST de la plataforma (§15.3): **NestJS 11 + Prisma 6 + PostgreSQL + JWT + Swagger**.

## Requisitos

- Node.js 20+ (probado en v24).
- La base de datos `inmobiliaria` creada y cargada (ver `../../database/`).

## Configuración

Las variables están en `apps/api/.env` (no se sube a git). Claves principales:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión Postgres (usuario `inmobiliaria_app`). |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` | Secreto y vigencia del access token (15m). |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL` | Secreto y vigencia del refresh token (7d). |
| `CORS_ORIGINS` | Orígenes permitidos (web/móvil), separados por coma. |
| `PORT` / `API_PREFIX` | Puerto (3000) y prefijo de rutas (`api`). |

## Arranque

```bash
npm install            # desde apps/api
npm run prisma:generate
npm run start:dev      # modo watch
# o producción:
npm run build && npm run start:prod
```

- API: `http://localhost:3000/api`
- Health: `GET /api/health`
- **Swagger:** `http://localhost:3000/api/docs`

## Estructura

```
src/
  app.module.ts            Guards globales (Throttler -> JWT -> Roles), módulos
  app.controller.ts        Health check
  main.ts                  Prefijo, ValidationPipe, helmet, CORS, Swagger
  prisma/                  PrismaModule (global) + PrismaService
  common/
    decorators/            @Public, @Roles, @CurrentUser
    guards/                JwtAuthGuard, RolesGuard
  modules/
    auth/                  Registro, login, refresh+rotación, logout,
                           recuperación de contraseña, switch de rol
    users/                 GET/PATCH /users/me
prisma/
  schema.prisma            Modelo introspectado de la BD (18 modelos, 12 enums)
```

## Seguridad implementada (§19)

- Contraseñas con **bcrypt** (cost 12).
- **JWT** access + **refresh tokens con rotación** (hash SHA-256 almacenado, revocables).
- **Secure-by-default**: todas las rutas requieren JWT salvo las marcadas `@Public()`.
- **RBAC** con `RolesGuard` (`@Roles('admin')`, etc.).
- **Rate limiting** global + reforzado en login/registro/recuperación.
- **helmet**, **CORS** configurable y **validación/saneo** de DTOs (whitelist).

## Endpoints actuales (§17)

| Método | Ruta | Acceso |
|---|---|---|
| GET  | `/api/health` | público |
| POST | `/api/auth/register` | público |
| POST | `/api/auth/login` | público |
| POST | `/api/auth/refresh` | público |
| POST | `/api/auth/logout` | autenticado |
| GET  | `/api/auth/me` | autenticado |
| PATCH| `/api/auth/switch-role` | autenticado |
| POST | `/api/auth/forgot-password` | público |
| POST | `/api/auth/reset-password` | público |
| GET  | `/api/users/me` | autenticado |
| PATCH| `/api/users/me` | autenticado |
| GET  | `/api/property-types` | público |
| GET  | `/api/zones` | público |
| GET  | `/api/properties` | público (listado + filtros) |
| GET  | `/api/properties/:slug` | público (detalle) |
| GET  | `/api/properties/mine` | autenticado |
| POST | `/api/properties` | vendedor |
| PATCH| `/api/properties/:id` | dueño/admin |
| PATCH| `/api/properties/:id/publish` | dueño |
| PATCH| `/api/properties/:id/unpublish` | dueño |
| PATCH| `/api/properties/:id/sold` | dueño (vendida/alquilada) |
| DELETE| `/api/properties/:id` | dueño (baja lógica) |
| GET  | `/api/geocoding?address=&city=` | autenticado (Google) |
| GET  | `/api/conversations` | autenticado |
| POST | `/api/conversations` | comprador |
| GET  | `/api/conversations/:id/messages` | participante |
| POST | `/api/conversations/:id/messages` | participante |
| PATCH| `/api/messages/:id/read` | participante |
| GET  | `/api/properties/:id/availability` | público |
| GET  | `/api/properties/:id/availability/slots` | público (franjas) |
| POST | `/api/properties/:id/availability` | vendedor |
| PATCH| `/api/availability/:id` | vendedor |
| DELETE| `/api/availability/:id` | vendedor |
| POST | `/api/properties/:id/visit-requests` | comprador |
| GET  | `/api/visit-requests/me` | comprador |
| GET  | `/api/seller/visit-requests` | vendedor |
| GET  | `/api/seller/visits/calendar` | vendedor (calendario) |
| PATCH| `/api/visit-requests/:id/status` | vendedor/comprador |
| GET  | `/api/subscription-plans` | público |
| GET  | `/api/subscriptions/me` | autenticado |
| POST | `/api/subscriptions/activate` | autenticado |
| POST | `/api/subscriptions/renew` | autenticado |
| GET/POST/PATCH/DELETE | `/api/admin/subscription-plans` | admin |
| GET  | `/api/admin/subscriptions` | admin |
| PATCH| `/api/admin/subscriptions/:id/activate` | admin |
| PATCH| `/api/admin/subscriptions/:id/cancel` | admin |
| POST | `/api/payments/create` | autenticado |
| POST | `/api/payments/:id/upload-proof` | autenticado (comprobante) |
| GET  | `/api/payments/me` | autenticado |
| GET  | `/api/admin/payments` | admin |
| PATCH| `/api/admin/payments/:id/confirm` | admin |
| PATCH| `/api/admin/payments/:id/reject` | admin |
| POST | `/api/payments/webhook/:provider` | público (pasarela) |
| GET  | `/api/notifications` | autenticado |
| GET  | `/api/notifications/unread-count` | autenticado |
| PATCH| `/api/notifications/read-all` | autenticado |
| PATCH| `/api/notifications/:id/read` | autenticado |
| POST | `/api/admin/notifications/broadcast` | admin (publicidad) |
| POST | `/api/admin/notifications/subscription-reminders` | admin |
| POST | `/api/properties/:id/images` | dueño (multipart) |
| PATCH| `/api/properties/:id/images/reorder` | dueño |
| PATCH| `/api/properties/:id/images/:imageId/main` | dueño |
| DELETE| `/api/properties/:id/images/:imageId` | dueño |
| GET  | `/api/admin/properties` | admin |
| PATCH| `/api/admin/properties/:id/approve` | admin |
| PATCH| `/api/admin/properties/:id/reject` | admin |
| PATCH| `/api/admin/properties/:id/take-down` | admin |
| GET  | `/api/admin/dashboard` | admin (métricas) |
| GET  | `/api/admin/users` | admin (listar/buscar) |
| GET  | `/api/admin/users/:id` | admin (detalle) |
| PATCH| `/api/admin/users/:id/suspend` | admin |
| PATCH| `/api/admin/users/:id/activate` | admin |
| GET  | `/api/admin/logs` | admin (auditoría) |

> Cuenta admin de prueba: `admin@inmobiliaria.com` / `Admin123!`.

**Filtros del listado** (`GET /properties`): `q`, `type` (slug), `zone_id`, `city`, `operation`, `min_price`, `max_price`, `bedrooms`, `bathrooms`, `currency`, bbox del mapa (`min_lat`/`max_lat`/`min_lng`/`max_lng`), `sort` (`recent`|`price_asc`|`price_desc`), `page`, `limit`.

**Imágenes**: se suben a disco local (`apps/api/uploads/`, servidas en `/uploads/...`); formatos JPG/PNG/WEBP, máx. 5 MB. Migrable a S3/Cloudflare R2 (§15.4).

**Geocoding** (§5): `GOOGLE_MAPS_API_KEY` server-side. Al crear/editar una propiedad con dirección y sin coordenadas, se geocodifica automáticamente. La key nunca se expone al cliente.

**Búsqueda full-text** (§7): con `q`, el listado usa el índice GIN `search_vector` (`websearch_to_tsquery` en español) y permite `sort=relevance` (ranking `ts_rank`).

**Chat** (§9): conversaciones por propiedad (comprador↔vendedor), leído/no leído, conteo de no leídos y notificación `in_app` al receptor. Pensado para polling; ampliable a WebSockets.

**Visitas** (§10): el vendedor configura **disponibilidad semanal** por propiedad (día, horario, duración de franja y `capacity` = visitas por franja → varias visitas por día). El comprador ve **franjas calculadas** (`/availability/slots`) y solicita; se valida disponibilidad + capacidad. Estados: aceptar/rechazar/reprogramar/cancelar con notificación. `GET /seller/visits/calendar` devuelve las visitas agrupadas por día para el calendario del vendedor. Tabla nueva `visit_availability` (migración `database/migrations/001_visit_availability.sql`).

**Suscripciones** (§11, §18): planes (CRUD admin), `POST /subscriptions/activate` (plan gratis = activa al instante; de pago = `pending_payment` hasta confirmar el pago), `renew`, `me`. Admin activa/cancela manualmente. **Vencimiento perezoso**: al consultar, si pasó `end_date` la suscripción pasa a `expired` y se notifica. **Regla §18 aplicada al publicar**: requiere suscripción activa y respeta `max_active_properties` del plan (configurable con el setting `subscriptions.require_for_publish`).

**Pagos** (§12) — **listos para una pasarela real**. Abstracción `PaymentProvider` (`createCharge` + `parseWebhook`) con dos implementaciones: `ManualPaymentProvider` (QR/transferencia con comprobante + confirmación del admin) y `GatewayStubProvider` (tarjeta/PayPal, sandbox). Flujos: crear orden → (subir comprobante | checkout de pasarela) → confirmar (admin **o** webhook) → `confirmPayment` activa la suscripción (idempotente). Webhook público en `POST /payments/webhook/:provider` con verificación de secreto (`PAYMENTS_WEBHOOK_SECRET`). Columnas `provider` + `metadata` en `payments` (migración 002).

### Conectar una pasarela real

1. Implementar `PaymentProvider` para el proveedor (p. ej. `DlocalProvider`): `createCharge` llama a su API y devuelve `checkoutUrl`; `parseWebhook` verifica la firma del proveedor.
2. Registrarlo en `payments.module.ts` y mapear el método.
3. Configurar credenciales en `.env` y el endpoint de webhook del proveedor → `/api/payments/webhook/<provider>`.

No hay que tocar la lógica de negocio: `confirmPayment`/`rejectPayment` ya activan/rechazan la suscripción.

**Notificaciones** (§14) — **in-app**. Los usuarios consultan/marcan leídas sus notificaciones (`GET /notifications`, `unread-count`, `read`/`read-all`). Se generan por eventos (nuevo mensaje, solicitud/cambio de visita, pago, suscripción vencida). El admin envía **publicidad/anuncios** masivos (`POST /admin/notifications/broadcast`, audiencia `all` o `sellers`, con enlace y tipo `promotion`) y **recordatorios de vencimiento** (`subscription-reminders`, idempotente). Hoy solo canal `in_app`; el envío por **email/push** queda como mejora (enchufar un proveedor en la creación de notificaciones).

**Panel admin** (§13) — `GET /admin/dashboard` devuelve métricas agregadas: usuarios (total, nuevos últimos 30d, por estado), propiedades (total, por estado), suscripciones activas, ingresos (total + últimos 30d), pagos pendientes y actividad reciente (últimos 10 admin_logs). Gestión de usuarios: listar/buscar con filtros (estado, rol, texto libre en nombre/email/teléfono), detalle con propiedades/suscripciones/pagos del usuario, suspender (con motivo + notificación) y reactivar. Auditoría: `GET /admin/logs` con filtros por admin y tipo de entidad. Todas las acciones admin (suspend/activate) se registran en `admin_logs` con entity_type/entity_id y generan notificación al usuario afectado.

## Próximos módulos

Frontend: Next.js (`apps/web`) y Expo (`apps/mobile`). Inicializar git y monorepo Turborepo/workspaces.

## Pendientes diferidos (servicios externos)

- Verificación por email / estado "pendiente de verificación" (§4.1) — falta proveedor de email.
- Compresión/optimización de imágenes (§6.2) — requiere `sharp`.
