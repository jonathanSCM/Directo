-- ============================================================================
--  Plataforma Web Inmobiliaria — MVP DIRECTO
--  Datos iniciales (seed). Idempotente: usa ON CONFLICT DO NOTHING.
--
--  Ejecutar DESPUÉS de schema.sql:
--      psql -d inmobiliaria -f seed.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Roles RBAC  (§3)
-- ---------------------------------------------------------------------------
INSERT INTO roles (name, description, permissions) VALUES
    ('buyer',  'Usuario comprador: busca, contacta y solicita visitas.',
        '["properties.view","properties.search","conversations.create","messages.send","visit_requests.create","notifications.view"]'),
    ('seller', 'Usuario vendedor/propietario: publica y gestiona propiedades.',
        '["properties.create","properties.update","properties.delete","property_images.manage","conversations.view","messages.send","visit_requests.manage","subscriptions.view"]'),
    ('admin',  'Administrador interno de la plataforma.',
        '["users.manage","properties.moderate","subscriptions.manage","payments.manage","settings.manage","reports.view","logs.view"]')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tipos de propiedad  (§13.6)
-- ---------------------------------------------------------------------------
INSERT INTO property_types (name, slug) VALUES
    ('Casa',             'casa'),
    ('Departamento',     'departamento'),
    ('Terreno',          'terreno'),
    ('Oficina',          'oficina'),
    ('Local comercial',  'local-comercial'),
    ('Galpón / Depósito','galpon-deposito'),
    ('Garaje',           'garaje')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Zonas (ejemplos)  (§13.6)
-- ---------------------------------------------------------------------------
INSERT INTO zones (name, city, latitude, longitude) VALUES
    ('Equipetrol',     'Santa Cruz de la Sierra', -17.7600000, -63.1900000),
    ('Centro',         'Santa Cruz de la Sierra', -17.7833000, -63.1821000),
    ('Las Palmas',     'Santa Cruz de la Sierra', -17.8000000, -63.1700000),
    ('Sopocachi',      'La Paz',                  -16.5100000, -68.1300000),
    ('Calacoto',       'La Paz',                  -16.5400000, -68.0800000),
    ('Cala Cala',      'Cochabamba',              -17.3700000, -66.1500000),
    ('Recoleta',       'Cochabamba',              -17.3900000, -66.1450000)
ON CONFLICT (name, city) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Planes de suscripción  (§11)
-- ---------------------------------------------------------------------------
INSERT INTO subscription_plans
    (name, slug, description, price, currency, duration_days,
     max_active_properties, max_images_per_property,
     allows_featured, includes_statistics, priority_in_results, publication_duration_days, is_active)
VALUES
    ('Gratis',       'gratis',       'Plan inicial para probar la plataforma.',
        0,   'USD', 30,  1,    5,  FALSE, FALSE, FALSE, 30, TRUE),
    ('Básico',       'basico',       'Para vendedores ocasionales.',
        9.99,'USD', 30,  5,    10, FALSE, FALSE, FALSE, 30, TRUE),
    ('Profesional',  'profesional',  'Para agentes activos: más propiedades y estadísticas.',
        24.99,'USD',30,  20,   20, TRUE,  TRUE,  FALSE, 60, TRUE),
    ('Premium',      'premium',      'Máxima visibilidad: destacadas y prioridad en resultados.',
        49.99,'USD',30,  NULL, 30, TRUE,  TRUE,  TRUE,  90, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Parámetros generales  (§13.6)
-- ---------------------------------------------------------------------------
INSERT INTO settings (key, value, description) VALUES
    ('platform.name',              '"Inmobiliaria MVP"',  'Nombre visible de la plataforma.'),
    ('properties.require_approval','true',                'Si toda propiedad nueva requiere aprobación del admin (§18).'),
    ('properties.default_currency','"USD"',               'Moneda por defecto para nuevas publicaciones.'),
    ('uploads.max_image_mb',       '5',                   'Tamaño máximo por imagen en MB (§6.2).'),
    ('uploads.allowed_formats',    '["jpg","jpeg","png","webp"]', 'Formatos de imagen permitidos (§6.2).'),
    ('legal.terms_url',            '""',                  'URL de Términos y Condiciones (§13.6).'),
    ('legal.privacy_url',          '""',                  'URL de Política de Privacidad (§13.6).'),
    ('subscriptions.grace_days',   '3',                   'Días de gracia tras vencer la suscripción.'),
    ('notifications.channels',     '["in_app","email"]',  'Canales de notificación activos en MVP (§14.2).')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Usuario administrador por defecto
--   email:    admin@inmobiliaria.com
--   password: Admin123!   (bcrypt, cost 12)  ->  ¡CAMBIAR EN PRODUCCIÓN!
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, status, active_role, email_verified_at)
VALUES (
    'Administrador',
    'admin@inmobiliaria.com',
    '$2b$12$k5LU9w8TfNRXJLGumB.X8.zRIFH0bdF2bKW8wVdZ0Q7WYG2ulLc4.',
    'active',
    'seller',
    now()
)
ON CONFLICT (email) DO NOTHING;

-- Asignar el rol admin al usuario administrador
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'admin@inmobiliaria.com'
  AND r.name = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
--  Fin del seed.
-- ============================================================================
