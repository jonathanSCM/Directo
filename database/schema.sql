-- ============================================================================
--  Plataforma Web Inmobiliaria — MVP DIRECTO
--  Esquema de base de datos (PostgreSQL 14+)
--
--  Construido a partir del "Scope técnico — Plataforma Web Inmobiliaria MVP",
--  sección 16 (Modelo de base de datos sugerido) y las reglas de negocio,
--  estados y módulos descritos en el resto del documento.
--
--  Convenciones:
--    * PK con UUID (gen_random_uuid) para evitar enumeración en recursos públicos.
--    * snake_case para tablas y columnas.
--    * created_at / updated_at en timestamptz (UTC).
--    * Estados modelados con tipos ENUM nativos de PostgreSQL.
--    * Borrado: CASCADE para contenido "hijo", RESTRICT/SET NULL para catálogos
--      y registros de auditoría.
--
--  Ejecutar:  psql -d inmobiliaria -f schema.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- emails / keys case-insensitive

-- ---------------------------------------------------------------------------
-- 1. Tipos ENUM (estados del sistema)
-- ---------------------------------------------------------------------------

-- Estado de la cuenta de usuario  (§3.x, §4.1 "Estados de usuario")
CREATE TYPE user_status AS ENUM (
    'active',
    'pending_verification',
    'suspended',
    'blocked'
);

-- Modo / rol activo del switch comprador-vendedor  (§4.2)
CREATE TYPE user_role_mode AS ENUM (
    'buyer',
    'seller'
);

-- Operación de la propiedad  (§7 filtros: venta / alquiler / anticrético)
CREATE TYPE property_operation AS ENUM (
    'sale',         -- venta
    'rent',         -- alquiler
    'anticretico'   -- anticrético
);

-- Ciclo de vida de la publicación  (§6.1 "Estados de propiedad")
CREATE TYPE property_status AS ENUM (
    'draft',            -- borrador
    'pending_approval', -- pendiente de aprobación
    'published',        -- publicada
    'rejected',         -- rechazada
    'paused',           -- pausada
    'taken_down',       -- dada de baja
    'sold_rented'       -- vendida / alquilada
);

-- Resultado de moderación del administrador  (§13.3)
CREATE TYPE approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

-- Estado de la solicitud de visita  (§10 "Estados sugeridos")
CREATE TYPE visit_request_status AS ENUM (
    'pending',      -- pendiente
    'accepted',     -- aceptada
    'rejected',     -- rechazada
    'rescheduled',  -- reprogramada
    'cancelled'     -- cancelada
);

-- Estado de la suscripción  (§11 "Estados de suscripción")
CREATE TYPE subscription_status AS ENUM (
    'active',           -- activa
    'expired',          -- vencida
    'cancelled',        -- cancelada
    'pending_payment',  -- pendiente de pago
    'in_review',        -- en revisión
    'renewed'           -- renovada
);

-- Estado del pago  (§12 "Estados de pago")
CREATE TYPE payment_status AS ENUM (
    'pending',      -- pendiente
    'in_review',    -- en revisión
    'confirmed',    -- confirmado
    'rejected',     -- rechazado
    'cancelled',    -- cancelado
    'refunded'      -- reembolsado
);

-- Método de pago  (§12 "Opciones contempladas")
CREATE TYPE payment_method AS ENUM (
    'visa',
    'paypal',
    'qr'
);

-- Tipo de notificación  (§14.1 / §14.3 "Eventos sugeridos")
CREATE TYPE notification_type AS ENUM (
    'account_registered',
    'new_message',
    'visit_request_received',
    'visit_request_updated',
    'property_approved',
    'property_rejected',
    'property_published',
    'subscription_expiring',
    'subscription_expired',
    'payment_confirmed',
    'payment_rejected',
    'system',
    'promotion'
);

-- Canal de envío de la notificación  (§14.2)
CREATE TYPE notification_channel AS ENUM (
    'in_app',
    'email',
    'push',
    'sms',
    'whatsapp'
);

-- Estado de entrega de la notificación
CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed'
);

-- ---------------------------------------------------------------------------
-- 2. Función + trigger genérico para updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- 3. Catálogos / tablas base (sin dependencias)
-- ===========================================================================

-- roles  (§3, §16 roles)  — RBAC: comprador, vendedor, administrador
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        CITEXT      NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE  roles IS 'Roles del sistema y sus permisos (RBAC). Visitante no se almacena.';
COMMENT ON COLUMN roles.permissions IS 'Lista/objeto JSON de permisos asociados al rol.';

-- property_types  (§16 property_types, §13.6 gestión de tipos)
CREATE TABLE property_types (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    slug       CITEXT       NOT NULL UNIQUE,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE property_types IS 'Catálogo de tipos de propiedad (casa, departamento, terreno, etc.).';

-- zones  (§16 zones, §13.6 gestión de zonas)
CREATE TABLE zones (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(150)   NOT NULL,
    city       VARCHAR(150)   NOT NULL,
    latitude   NUMERIC(10, 7),
    longitude  NUMERIC(10, 7),
    is_active  BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT zones_name_city_uniq UNIQUE (name, city),
    CONSTRAINT zones_latitude_chk  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    CONSTRAINT zones_longitude_chk CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
COMMENT ON TABLE zones IS 'Zonas/barrios geográficos para clasificar y filtrar propiedades.';

-- subscription_plans  (§11 planes, §16 subscription_plans)
CREATE TABLE subscription_plans (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     VARCHAR(120)  NOT NULL,
    slug                     CITEXT        NOT NULL UNIQUE,
    description              TEXT,
    price                    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency                 VARCHAR(3)    NOT NULL DEFAULT 'USD',
    duration_days            INTEGER       NOT NULL,
    max_active_properties    INTEGER,       -- NULL = ilimitado
    max_images_per_property  INTEGER,       -- NULL = ilimitado
    -- Reglas/beneficios del plan (§11.1 "Reglas posibles por plan")
    allows_featured          BOOLEAN       NOT NULL DEFAULT FALSE, -- publicaciones destacadas
    includes_statistics      BOOLEAN       NOT NULL DEFAULT FALSE, -- acceso a estadísticas
    priority_in_results      BOOLEAN       NOT NULL DEFAULT FALSE, -- prioridad en resultados
    publication_duration_days INTEGER,      -- duración de cada publicación
    is_active                BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plans_price_chk          CHECK (price >= 0),
    CONSTRAINT subscription_plans_duration_chk       CHECK (duration_days > 0),
    CONSTRAINT subscription_plans_max_props_chk      CHECK (max_active_properties   IS NULL OR max_active_properties   >= 0),
    CONSTRAINT subscription_plans_max_images_chk     CHECK (max_images_per_property IS NULL OR max_images_per_property >= 0)
);
COMMENT ON TABLE subscription_plans IS 'Planes de suscripción para vendedores y sus límites/beneficios.';

-- settings  (§13.6 / §16 settings)  — parámetros generales clave/valor
CREATE TABLE settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         CITEXT      NOT NULL UNIQUE,
    value       JSONB       NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE settings IS 'Parámetros generales de la plataforma (términos, políticas, flags, etc.).';

-- ===========================================================================
-- 4. Usuarios y autenticación
-- ===========================================================================

-- users  (§3, §4.1, §16 users)
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(150)   NOT NULL,
    email             CITEXT         NOT NULL UNIQUE,
    password_hash     TEXT           NOT NULL,
    phone             VARCHAR(30),
    avatar_url        TEXT,
    city              VARCHAR(150),
    active_role       user_role_mode NOT NULL DEFAULT 'buyer',  -- switch comprador/vendedor
    status            user_status    NOT NULL DEFAULT 'pending_verification',
    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),   -- fecha de registro
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT users_email_format_chk CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
COMMENT ON TABLE  users IS 'Cuentas de usuario. Una sola cuenta opera como comprador y/o vendedor (active_role).';
COMMENT ON COLUMN users.active_role IS 'Modo activo del switch comprador/vendedor en la UI.';
COMMENT ON COLUMN users.status IS 'Estado de la cuenta: active / pending_verification / suspended / blocked.';

-- user_roles  (M:N usuarios<->roles)
CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);
COMMENT ON TABLE user_roles IS 'Asignación de roles RBAC a usuarios (comprador, vendedor, admin).';

-- password_reset_tokens  (§4.1 recuperación de contraseña)
CREATE TABLE password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE password_reset_tokens IS 'Tokens (hash) para el flujo de recuperación de contraseña.';

-- refresh_tokens  (§19 JWT + refresh tokens recomendado)
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens (hash) por sesión/dispositivo para renovar el JWT.';

-- ===========================================================================
-- 5. Propiedades e imágenes
-- ===========================================================================

-- properties  (§6, §8, §16 properties)
CREATE TABLE properties (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(200)    NOT NULL,
    slug             CITEXT          NOT NULL UNIQUE,
    description      TEXT,
    property_type_id UUID            NOT NULL REFERENCES property_types(id) ON DELETE RESTRICT,
    zone_id          UUID            REFERENCES zones(id) ON DELETE SET NULL,
    operation        property_operation NOT NULL DEFAULT 'sale',
    price            NUMERIC(14, 2)  NOT NULL,
    currency         VARCHAR(3)      NOT NULL DEFAULT 'USD',
    address          VARCHAR(255),
    latitude         NUMERIC(10, 7),
    longitude        NUMERIC(10, 7),
    bedrooms         SMALLINT,
    bathrooms        SMALLINT,
    area_m2          NUMERIC(10, 2),
    status           property_status NOT NULL DEFAULT 'draft',
    approval_status  approval_status NOT NULL DEFAULT 'pending',
    is_featured      BOOLEAN         NOT NULL DEFAULT FALSE,  -- destacada (§13.3)
    rejection_reason TEXT,                                    -- motivo de rechazo del admin
    views_count      INTEGER         NOT NULL DEFAULT 0,      -- estadísticas (§11)
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    -- Búsqueda full-text (§7 buscador) sobre título + descripción
    search_vector    tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(description, '')), 'B')
    ) STORED,
    CONSTRAINT properties_price_chk     CHECK (price >= 0),
    CONSTRAINT properties_bedrooms_chk  CHECK (bedrooms  IS NULL OR bedrooms  >= 0),
    CONSTRAINT properties_bathrooms_chk CHECK (bathrooms IS NULL OR bathrooms >= 0),
    CONSTRAINT properties_area_chk      CHECK (area_m2   IS NULL OR area_m2   >= 0),
    CONSTRAINT properties_latitude_chk  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    CONSTRAINT properties_longitude_chk CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
COMMENT ON TABLE  properties IS 'Publicaciones de propiedades creadas por usuarios en modo vendedor.';
COMMENT ON COLUMN properties.status IS 'Ciclo de vida: draft/pending_approval/published/rejected/paused/taken_down/sold_rented.';
COMMENT ON COLUMN properties.approval_status IS 'Resultado de moderación del administrador.';
COMMENT ON COLUMN properties.search_vector IS 'Vector tsvector (español) para búsqueda de texto sobre título y descripción.';

-- property_images  (§6.2, §16 property_images)
CREATE TABLE property_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    url         TEXT        NOT NULL,
    is_main     BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE property_images IS 'Galería de imágenes de una propiedad. Una sola imagen principal por propiedad.';

-- ===========================================================================
-- 6. Chat (conversaciones y mensajes)
-- ===========================================================================

-- conversations  (§9, §16 conversations)  — siempre asociada a una propiedad
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    buyer_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversations_unique UNIQUE (property_id, buyer_id, seller_id),
    CONSTRAINT conversations_distinct_users_chk CHECK (buyer_id <> seller_id)
);
COMMENT ON TABLE conversations IS 'Hilo de chat entre comprador y vendedor, asociado a una propiedad (§9).';

-- messages  (§9, §16 messages)
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT        NOT NULL,
    is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_not_empty_chk CHECK (length(btrim(message)) > 0)
);
COMMENT ON TABLE messages IS 'Mensajes individuales dentro de una conversación.';

-- ===========================================================================
-- 7. Solicitudes de visita
-- ===========================================================================

-- visit_requests  (§10, §16 visit_requests)
CREATE TABLE visit_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id    UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    buyer_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_date DATE        NOT NULL,
    requested_time TIME,
    message        TEXT,
    status         visit_request_status NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT visit_requests_distinct_users_chk CHECK (buyer_id <> seller_id)
);
COMMENT ON TABLE visit_requests IS 'Solicitudes de visita de un comprador hacia una propiedad y su vendedor (§10).';

-- visit_availability  (§10)  — disponibilidad semanal recurrente por propiedad
CREATE TABLE visit_availability (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id  UUID    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    weekday      SMALLINT NOT NULL,            -- 0=domingo .. 6=sábado (JS getUTCDay)
    start_time   TIME    NOT NULL,
    end_time     TIME    NOT NULL,
    slot_minutes INTEGER NOT NULL DEFAULT 30,  -- duración de cada franja
    capacity     INTEGER NOT NULL DEFAULT 1,   -- visitas admitidas por franja
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT visit_availability_weekday_chk  CHECK (weekday BETWEEN 0 AND 6),
    CONSTRAINT visit_availability_time_chk     CHECK (end_time > start_time),
    CONSTRAINT visit_availability_slot_chk     CHECK (slot_minutes > 0),
    CONSTRAINT visit_availability_capacity_chk CHECK (capacity >= 1)
);
COMMENT ON TABLE visit_availability IS 'Disponibilidad semanal recurrente de una propiedad para recibir visitas (§10).';

-- ===========================================================================
-- 8. Suscripciones y pagos
-- ===========================================================================

-- subscriptions  (§11, §16 subscriptions)
CREATE TABLE subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id    UUID        NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status     subscription_status NOT NULL DEFAULT 'pending_payment',
    start_date TIMESTAMPTZ,
    end_date   TIMESTAMPTZ,
    renewed_at TIMESTAMPTZ,
    auto_renew BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_dates_chk CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
COMMENT ON TABLE subscriptions IS 'Suscripción de un vendedor a un plan, con vigencia (§11, §18).';

-- payments  (§12, §16 payments)
CREATE TABLE payments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id       UUID        REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount                NUMERIC(12, 2) NOT NULL,
    currency              VARCHAR(3)  NOT NULL DEFAULT 'USD',
    method                payment_method NOT NULL,
    transaction_reference VARCHAR(255),
    proof_url             TEXT,                              -- comprobante (QR/manual)
    provider              VARCHAR(40) NOT NULL DEFAULT 'manual', -- pasarela (manual, dlocal, stripe...)
    metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb, -- payload del proveedor
    status                payment_status NOT NULL DEFAULT 'pending',
    paid_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payments_amount_chk CHECK (amount >= 0)
);
COMMENT ON TABLE payments IS 'Pagos de suscripciones. Un pago confirmado activa/renueva la suscripción (§18).';

-- ===========================================================================
-- 9. Notificaciones y auditoría
-- ===========================================================================

-- notifications  (§14, §16 notifications)
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       notification_type    NOT NULL,
    title      VARCHAR(200) NOT NULL,
    message    TEXT,
    channel    notification_channel NOT NULL DEFAULT 'in_app',
    status     notification_status  NOT NULL DEFAULT 'pending',
    data       JSONB        NOT NULL DEFAULT '{}'::jsonb,    -- payload/links a la entidad
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE notifications IS 'Notificaciones por usuario y canal (in_app/email/push/sms/whatsapp).';

-- admin_logs  (§16 admin_logs, §22 logs de acciones administrativas)
CREATE TABLE admin_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80),
    entity_id   UUID,
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_logs IS 'Bitácora de acciones administrativas (auditoría). admin_id se conserva como SET NULL.';

-- ===========================================================================
-- 10. Índices
-- ===========================================================================

-- users
CREATE INDEX idx_users_status      ON users (status);
CREATE INDEX idx_users_active_role ON users (active_role);

-- user_roles
CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

-- auth tokens
CREATE INDEX idx_password_reset_user  ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_expire ON password_reset_tokens (expires_at);
CREATE INDEX idx_refresh_tokens_user  ON refresh_tokens (user_id);

-- property_types / zones
CREATE INDEX idx_property_types_active ON property_types (is_active);
CREATE INDEX idx_zones_city            ON zones (city);
CREATE INDEX idx_zones_active          ON zones (is_active);

-- properties (filtros §7 + relaciones)
CREATE INDEX idx_properties_owner        ON properties (owner_id);
CREATE INDEX idx_properties_type         ON properties (property_type_id);
CREATE INDEX idx_properties_zone         ON properties (zone_id);
CREATE INDEX idx_properties_status       ON properties (status);
CREATE INDEX idx_properties_approval     ON properties (approval_status);
CREATE INDEX idx_properties_operation    ON properties (operation);
CREATE INDEX idx_properties_price        ON properties (price);
CREATE INDEX idx_properties_bedrooms     ON properties (bedrooms);
CREATE INDEX idx_properties_published_at ON properties (published_at DESC);
CREATE INDEX idx_properties_featured     ON properties (is_featured) WHERE is_featured;
-- Listado público típico: publicadas+aprobadas ordenadas por fecha
CREATE INDEX idx_properties_public_feed  ON properties (status, approval_status, published_at DESC);
-- Geolocalización (mapa §5): consultas por bounding box lat/lng
CREATE INDEX idx_properties_geo          ON properties (latitude, longitude);
-- Búsqueda full-text §7
CREATE INDEX idx_properties_search       ON properties USING GIN (search_vector);

-- property_images: una sola imagen principal por propiedad
CREATE UNIQUE INDEX uq_property_main_image ON property_images (property_id) WHERE is_main;
CREATE INDEX idx_property_images_property  ON property_images (property_id, sort_order);

-- conversations
CREATE INDEX idx_conversations_property ON conversations (property_id);
CREATE INDEX idx_conversations_buyer    ON conversations (buyer_id);
CREATE INDEX idx_conversations_seller   ON conversations (seller_id);
CREATE INDEX idx_conversations_last_msg ON conversations (last_message_at DESC);

-- messages
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_sender       ON messages (sender_id);
-- mensajes no leídos por conversación
CREATE INDEX idx_messages_unread       ON messages (conversation_id) WHERE is_read = FALSE;

-- visit_requests
CREATE INDEX idx_visit_requests_property ON visit_requests (property_id);
CREATE INDEX idx_visit_requests_buyer    ON visit_requests (buyer_id);
CREATE INDEX idx_visit_requests_seller   ON visit_requests (seller_id);
CREATE INDEX idx_visit_requests_status   ON visit_requests (status);
CREATE INDEX idx_visit_requests_date     ON visit_requests (property_id, requested_date);

-- visit_availability
CREATE INDEX idx_visit_availability_property ON visit_availability (property_id, weekday);

-- subscriptions
CREATE INDEX idx_subscriptions_user   ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_plan   ON subscriptions (plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_end    ON subscriptions (end_date);
-- una sola suscripción ACTIVA por usuario
CREATE UNIQUE INDEX uq_active_subscription_per_user ON subscriptions (user_id) WHERE status = 'active';

-- payments
CREATE INDEX idx_payments_user         ON payments (user_id);
CREATE INDEX idx_payments_subscription ON payments (subscription_id);
CREATE INDEX idx_payments_status       ON payments (status);
CREATE INDEX idx_payments_method       ON payments (method);
CREATE INDEX idx_payments_paid_at      ON payments (paid_at DESC);
CREATE INDEX idx_payments_reference    ON payments (transaction_reference);

-- notifications
CREATE INDEX idx_notifications_user        ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;

-- admin_logs
CREATE INDEX idx_admin_logs_admin  ON admin_logs (admin_id);
CREATE INDEX idx_admin_logs_entity ON admin_logs (entity_type, entity_id);
CREATE INDEX idx_admin_logs_date   ON admin_logs (created_at DESC);

-- ===========================================================================
-- 11. Triggers updated_at
-- ===========================================================================
CREATE TRIGGER trg_roles_updated_at              BEFORE UPDATE ON roles              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_property_types_updated_at      BEFORE UPDATE ON property_types      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_zones_updated_at              BEFORE UPDATE ON zones              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscription_plans_updated_at  BEFORE UPDATE ON subscription_plans  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated_at           BEFORE UPDATE ON settings           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at              BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at         BEFORE UPDATE ON properties         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conversations_updated_at      BEFORE UPDATE ON conversations      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visit_requests_updated_at     BEFORE UPDATE ON visit_requests     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visit_availability_updated_at  BEFORE UPDATE ON visit_availability  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at      BEFORE UPDATE ON subscriptions      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at           BEFORE UPDATE ON payments           FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ============================================================================
--  Fin del esquema. Ejecutar seed.sql para datos iniciales.
-- ============================================================================
