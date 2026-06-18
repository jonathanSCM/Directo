# DIRECTO — App Inmobiliaria MVP

## Resumen del proyecto
App inmobiliaria para Bolivia llamada "DIRECTO". Conecta propietarios con compradores/inquilinos sin intermediarios. Mapa interactivo con propiedades, contacto directo por WhatsApp.

---

## Stack tecnologico

### Backend (`apps/api/`)
- **NestJS 11** + TypeScript
- **Prisma ORM** + **PostgreSQL 18**
- JWT auth con refresh token rotation
- Swagger docs en `/api/docs`
- Puerto: **3000**, prefijo API: `/api`

### Frontend Mobile (`apps/mobile/`)
- **Expo SDK 54** (React Native 0.81.5, React 19.1.0)
- **expo-router v6** (file-based routing)
- **react-native-maps** + **react-native-map-clustering**
- **axios** con interceptor JWT + refresh automático
- **expo-secure-store** para tokens
- **AsyncStorage** para favoritos (persiste sin login)
- **expo-location** para permisos de ubicacion
- Puerto Expo: **8081**

### Dependencias mobile clave
```
expo@54, expo-router@6, react-native-maps@1.20.1,
react-native-map-clustering@4.0.0, axios@1.18,
expo-location@19, expo-secure-store@15,
@react-native-async-storage/async-storage@2.2
```

---

## Entorno de desarrollo

- **PostgreSQL**: superuser `postgres` / `987654321`, database `inmobiliaria`
- **psql path**: `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`
- **Admin seed**: `admin@inmobiliaria.com` / `Admin123!`
- **Google Maps API key**: `AIzaSyCcTZm5Oszhtrq7_X3_LIh3mCSaOpckcAA`
- **IP WiFi del PC**: `192.168.0.4`
- API auto-detecta IP via `Constants.expoConfig.hostUri`

### Levantar el proyecto
```bash
# Terminal 1 — Backend
cd apps/api
npm run start:dev

# Terminal 2 — Mobile
cd apps/mobile
npx expo start
```

---

## Base de datos (15 tablas)

```
users, roles, user_roles, refresh_tokens, password_reset_tokens,
properties, property_images, property_types, zones,
subscriptions, subscription_plans, payments,
notifications, admin_logs, settings
```

### Datos de prueba actuales
- **5 usuarios** (4 owners, 1 buyer)
- **15 propiedades publicadas** (7 venta, 5 alquiler, 3 anticretico)
- **7 zonas** en 3 ciudades (Santa Cruz, La Paz, Cochabamba)
- **7 tipos de propiedad** (casa, departamento, terreno, oficina, local-comercial, galpon-deposito, garaje)

### IDs importantes (para seeds)
- **Property types**: casa=`2891613c`, departamento=`22574ee1`, terreno=`46f7b8ab`, oficina=`f4cf1505`, local-comercial=`4ead6b4a`, galpon-deposito=`1e56c95c`, garaje=`5c1b097a`
- **Zones**: Equipetrol=`ed333fcc`, Centro=`2db22fb3`, Las Palmas=`33cf7b62`, Sopocachi=`8186ce7d`, Calacoto=`f74a7bf1`, Cala Cala=`71f70d9a`, Recoleta=`090b0ac9`
- **Users**: `d81a8e50` (owner), `fe91a408` (owner), `04d83d05` (owner), `c0234e34` (buyer), `9d86b9ce` (owner)

### Nota critica: al insertar propiedades
Las propiedades necesitan **`status = 'published'` Y `approval_status = 'approved'`** para aparecer en el listado publico. El valor por defecto de `approval_status` es `'pending'`, asi que hay que setearlo manualmente en SQL seeds.

---

## Backend — Modulos y endpoints

### Auth (`/api/auth`)
- `POST /register` — registro con name, email, password, phone?, city?
- `POST /login` — devuelve accessToken + refreshToken + user + roles
- `POST /refresh` — rota refresh token
- `POST /logout` — invalida refresh token
- `POST /google` — login con Google idToken
- `PATCH /switch-role` — cambiar entre buyer/owner

### Users (`/api/users`)
- `GET /me` — perfil propio
- `PATCH /me` — actualizar perfil (name, phone, city, avatar_url)

### Properties (`/api/properties`)
- `GET /` — listado publico con filtros:
  - `q` (texto), `operation` (sale/rent/anticretico), `type` (slug del tipo)
  - `min_price`, `max_price`, `bedrooms`, `bathrooms`, `currency`
  - `min_lat`, `max_lat`, `min_lng`, `max_lng` (bounding box para mapa)
  - `zone_id`, `city`, `sort` (recent/price_asc/price_desc/relevance)
  - `page`, `limit` (max 100)
- `GET /:slug` — detalle por slug (incrementa views_count)
- `GET /mine` — mis propiedades (requiere auth, cualquier status)
- `POST /` — crear propiedad (modo owner)
- `PATCH /:id` — editar propiedad
- `DELETE /:id` — eliminar propiedad

### Response shape de properties
```json
{
  "data": [{
    "id": "uuid",
    "title": "...",
    "slug": "...",
    "description": "...",
    "address": "...",
    "price": "189000",        // STRING (Decimal de Prisma)
    "currency": "USD",
    "operation": "sale",       // sale | rent | anticretico
    "status": "published",
    "latitude": "-17.762",     // STRING (Decimal de Prisma)
    "longitude": "-63.192",   // STRING
    "bedrooms": 4,
    "bathrooms": 3,
    "area_m2": 320,
    "whatsapp": "+59170000001",
    "views_count": 45,
    "property_images": [{ "id": "...", "url": "...", "is_main": true }],
    "property_types": { "name": "Casa", "slug": "casa" },
    "zones": { "name": "Equipetrol", "city": "Santa Cruz de la Sierra" },
    "users": { "name": "Juan", "phone": "..." }
  }],
  "meta": { "page": 1, "limit": 20, "total": 15, "totalPages": 1 }
}
```
**IMPORTANTE**: `price`, `latitude`, `longitude` vienen como STRING desde Prisma. En el frontend se castean con `Number()`.

### Catalogos (`/api/catalog`)
- `GET /property-types` — lista de tipos de propiedad
- `GET /zones` — lista de zonas con ciudad

### Subscriptions (`/api/subscriptions`)
- `GET /me` — mi suscripción actual (incluye plan)
- `POST /activate` — body: `{ plan_id }`. Plan gratis = activa inmediato. Plan pago = status `pending_payment`
- `POST /renew` — renovar suscripción actual
- `POST /free-trial` — activar prueba gratuita 30 días (1 propiedad, una vez por owner)
- `GET /free-trial/status` — `{ used: boolean }`
- `GET /subscription-plans` — listar planes activos (público)
- Enforcement: `assertCanPublish()` verifica suscripción activa + límite de propiedades al crear/publicar

### Payments (`/api/payments`)
- Solo QR como metodo de pago
- Webhook para confirmacion

### Notifications (`/api/notifications`)
- Push notifications, broadcast admin, recordatorios

### Admin (`/api/admin`)
- Dashboard, logs, moderacion de propiedades (aprobar/rechazar/bajar)
- Gestion de usuarios, suscripciones, pagos

---

## Frontend Mobile — Estructura de archivos

### Navegacion (expo-router file-based)
```
app/
  _layout.tsx              — Root: AuthProvider > FavoritesProvider > Stack
  index.tsx                — Redirect
  (auth)/
    _layout.tsx            — Auth stack
    onboarding.tsx         — Pantalla inicial con background image
    login.tsx              — Login con email/password
    register.tsx           — Registro con city picker modal
  (tabs)/
    _layout.tsx            — 3 tabs: Explorar, Guardados/Mis Propiedades, Perfil
    index.tsx              — Mapa con clustering + viewport filtering + filtros
    saved.tsx              — Favoritos (buyer) o Mis Propiedades (owner)
    messages.tsx           — OCULTO (href: null), legacy
    profile.tsx            — Perfil, role switcher, menu
  property/
    [id].tsx               — Detalle de propiedad (por slug)
  edit-profile.tsx         — Editar perfil (PATCH /users/me)
  create-property.tsx      — Formulario publicar propiedad (POST /properties)
  subscription.tsx         — Mi suscripción + planes disponibles + free trial
```

### Contextos (`src/context/`)
- **AuthContext** — login, register, logout, switchRole, refreshUser, JWT con SecureStore
- **FavoritesContext** — favoritos con AsyncStorage, persiste sin login. Provee: favorites, isFavorite, toggleFavorite, count

### Servicios (`src/services/`)
- **api.ts** — axios con interceptor JWT + refresh token rotation automatica
- **auth.ts** — llamadas a /auth/* endpoints

### Componentes (`src/components/`)
- **Logo.tsx** — logo con variantes blue/white
- **FilterModal.tsx** — bottom sheet con filtros (operacion, tipo, precio, dormitorios)

### Constantes (`src/constants/`)
- **api.ts** — API_BASE_URL (auto-detecta IP del dev server)
- **theme.ts** — Colors, Fonts, Spacing, Radius

### Assets
- `assets/markers/` — 4 PNGs (80x100px): marker-sale, marker-rent, marker-anti, marker-active
- `assets/onboarding-bg.png` — fondo del onboarding

---

## Funcionalidades implementadas

### Mapa (Explorar)
- Mapa Google con clustering (react-native-map-clustering)
- Viewport filtering: solo carga propiedades del area visible (debounce 500ms)
- Bounding box params: min_lat, max_lat, min_lng, max_lng
- Marcadores custom por tipo de operacion (venta=dorado, alquiler=rojo, anticretico=verde)
- Marcador activo (teal) al seleccionar
- Carrusel horizontal de tarjetas (FlatList)
- Barra de busqueda con texto + boton de filtros
- Chips de operacion (Todos/Venta/Alquiler/Anticretico)
- Boton "mi ubicacion" con expo-location
- Contador de propiedades visibles

### Filtros (FilterModal)
- Tipo de operacion (Venta/Alquiler/Anticretico) con colores
- Tipo de inmueble (Casa/Depto/Terreno/Oficina/Local) con iconos
- Rango de precio min/max
- Numero de dormitorios (1-5+)
- Botones Limpiar y Aplicar

### Favoritos (Guardados)
- Corazon en tarjetas del mapa y detalle
- Persistencia con AsyncStorage (sobrevive logout y cierre de app)
- Tab "Guardados" muestra lista de favoritos con WhatsApp

### Detalle de propiedad
- Galeria de imagenes
- Info completa: precio, operacion, specs, descripcion
- Boton WhatsApp para contactar propietario
- Boton compartir
- Link a Google Maps
- Tarjeta del propietario
- Boton favorito

### Perfil
- Tarjeta de usuario (avatar inicial, nombre, email, telefono)
- Switch de modo Comprador/Propietario (segmented control)
- Quick stats (guardados, mis propiedades)
- Menu: editar perfil, notificaciones, publicar, suscripcion, estadisticas
- WhatsApp soporte
- Cerrar sesion con confirmacion

### Editar perfil
- Campos: nombre, email (no editable), telefono, ciudad
- PATCH /users/me
- refreshUser() actualiza AuthContext despues de guardar

### Modo propietario
- Tab "Guardados" cambia a "Mis Propiedades"
- GET /properties/mine
- Stats: total, publicadas, vistas
- Lista con badges de estado (draft, pending, published, rejected, sold, rented, paused)

### Onboarding
- Background image con overlay
- 3 CTAs: Crear cuenta, Ya tengo cuenta, Explorar sin cuenta

### Publicar propiedad (create-property)
- Formulario completo: operación, título, tipo de inmueble, precio+moneda, descripción, dirección, zona, dormitorios/baños/área, WhatsApp
- Pickers modales para tipo de inmueble y zona (cargados desde /property-types y /zones)
- Toggle USD/BOB para moneda
- POST /properties — queda en `pending_approval` hasta que admin la apruebe
- Validación: título min 5 chars, tipo y precio obligatorios
- Requiere suscripción activa (el backend valida con assertCanPublish)

### Suscripciones (subscription)
- Muestra suscripción actual con status, fechas, días restantes, límite de propiedades
- Badges de estado: Activa (verde), Vencida (rojo), Pendiente de pago (amarillo), Cancelada (gris)
- Botón renovar suscripción
- Card de prueba gratuita (30 días, 1 propiedad, se oculta si ya se usó)
- Lista de planes disponibles con precio, duración, features
- Botón contratar plan — planes gratis se activan directo, pagos quedan en pending_payment
- Carga paralela: GET /subscriptions/me + GET /subscription-plans + GET /free-trial/status

### Auth
- Login email/password
- Registro con city picker
- JWT con refresh token rotation
- Proteccion de rutas (permite navegar sin auth)

---

## Problemas conocidos y soluciones aplicadas

| Problema | Solucion |
|----------|----------|
| Prisma Decimal viene como string | `Number()` en latitude, longitude, price |
| Custom markers no renderizan en Android con child Image | Usar prop `image` directamente en `<Marker>` |
| `tracksViewChanges={false}` impide render de imagen | Solo activar para marcador seleccionado |
| `backdropFilter` no existe en RN | Removido, usar overlay rgba |
| Properties no aparecen | Necesitan `approval_status = 'approved'` ademas de `status = 'published'` |
| Prisma EPERM al regenerar | `taskkill /F /IM node.exe` + borrar `.prisma` |
| API prefix | Backend usa `/api` prefix, frontend lo incluye en `API_BASE_URL` |

---

## Pendiente / TODO

- [ ] Verificar marcadores custom en dispositivo fisico
- [ ] Pantalla de notificaciones
- [ ] Subida de imagenes de propiedades desde mobile (la pantalla de crear propiedad no sube fotos aún)
- [ ] Integrar pagos con QR (flujo completo: generar QR, confirmar pago, activar suscripción)
- [ ] Deploy a produccion (backend + APK)
- [ ] Tests automatizados
