# Despliegue en Coolify (Dockerfiles)

Repo: `https://github.com/jonathanSCM/Directo.git`

Se crean **4 recursos** en Coolify: 1 base de datos + 3 aplicaciones.

---

## 1. PostgreSQL (recurso de base de datos)

Coolify → **+ New → Database → PostgreSQL** (versión 16).

- Usuario: `inmobiliaria_app`
- Contraseña: genera una segura (NO usar la de desarrollo)
- Base de datos: `inmobiliaria`

Una vez creada, inicializa el esquema conectándote a ella (con la URL interna
que muestra Coolify) y ejecutando **en este orden**:

```
database/schema.sql
apps/api/prisma/migrations/manual/add_amenities.sql
database/seed.sql
database/migrations/001_visit_availability.sql
database/migrations/002_payments_gateway.sql
database/migrations/003_notification_promotion.sql
database/migrations/004_directo_changes.sql
database/migrations/005_google_oauth.sql
apps/api/prisma/migrations/manual/add_favorites.sql
apps/api/prisma/migrations/manual/add_support_chat.sql
```

> Tip: puedes usar la terminal del contenedor en Coolify o
> `psql "postgres://..." -f archivo.sql` desde tu máquina si expones el puerto temporalmente.

---

## 2. API (NestJS)

Coolify → **+ New → Application → repositorio Git** → este repo.

| Ajuste | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/apps/api` |
| Dockerfile Location | `/apps/api/Dockerfile` |
| Puerto expuesto | `3000` |

**Variables de entorno:**

```env
NODE_ENV=production
PORT=3000
API_PREFIX=api
DATABASE_URL=postgresql://inmobiliaria_app:<PASSWORD>@<host-interno-db>:5432/inmobiliaria?schema=public
JWT_ACCESS_SECRET=<generar: openssl rand -hex 32>
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=<generar: openssl rand -hex 32>
JWT_REFRESH_TTL=7d
CORS_ORIGINS=https://admin.tudominio.com,https://app.tudominio.com
GOOGLE_MAPS_API_KEY=<tu key>
GEOCODING_REGION=bo
GOOGLE_CLIENT_ID=<tu client id>
APP_PUBLIC_URL=https://api.tudominio.com
PAYMENTS_WEBHOOK_SECRET=<generar: openssl rand -hex 32>
```

> `<host-interno-db>` es el hostname interno que Coolify asigna al recurso
> PostgreSQL (visible en su panel). Ambos recursos deben estar en el mismo
> "Destination"/red de Docker.

**Storage persistente (imprescindible):**
- Volume mount: `/app/uploads` → para que las imágenes de propiedades
  sobrevivan a los redeploys.

**Dominio:** `https://api.tudominio.com`

---

## 3. Panel Admin (React + Vite → nginx)

Coolify → **+ New → Application** → mismo repo.

| Ajuste | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/apps/admin` |
| Dockerfile Location | `/apps/admin/Dockerfile` |
| Puerto expuesto | `80` |

**Build argument** (no runtime env — Vite lo necesita en build):

```env
VITE_API_URL=https://api.tudominio.com/api
```

En Coolify marca la variable como **"Build Variable"**.

**Dominio:** `https://admin.tudominio.com`

---

## 4. Web pública (Expo Web → nginx)

Coolify → **+ New → Application** → mismo repo.

| Ajuste | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/apps/mobile` |
| Dockerfile Location | `/apps/mobile/Dockerfile.web` |
| Puerto expuesto | `80` |

**Build argument:**

```env
EXPO_PUBLIC_API_URL=https://api.tudominio.com/api
```

También como **"Build Variable"**.

**Dominio:** `https://app.tudominio.com` (o el dominio raíz)

---

## Orden de despliegue

1. PostgreSQL → esperar que esté healthy → ejecutar los SQL
2. API → verificar `https://api.tudominio.com/api/docs` (Swagger)
3. Admin y Web (necesitan la URL final de la API como build arg)

## Checklist post-despliegue

- [ ] Swagger responde en `/api/docs`
- [ ] Login en el panel admin funciona
- [ ] `CORS_ORIGINS` incluye los dominios de admin y web (sin barra final)
- [ ] Subir una imagen de propiedad y redeploy de la API → la imagen persiste
- [ ] En Google Cloud Console: agregar los dominios de producción a los
      orígenes autorizados del OAuth Client y a las restricciones de la API key
- [ ] Cambiar todas las contraseñas/secrets de desarrollo

## Notas

- **App móvil nativa (Expo)**: no se despliega en Coolify. Se compila con
  `eas build` apuntando `EXPO_PUBLIC_API_URL` a la API de producción.
- El `docker-compose.yml` de la raíz sirve para levantar todo localmente
  (`docker compose up`), no lo usa Coolify en esta configuración.
- Auto-deploy: activa el webhook de GitHub en cada app de Coolify para que
  cada push a `main` redepliegue automáticamente.
