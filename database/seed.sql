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
    -- Santa Cruz de la Sierra
    ('Equipetrol',           'Santa Cruz de la Sierra', -17.7600000, -63.1900000),
    ('Centro',               'Santa Cruz de la Sierra', -17.7833000, -63.1821000),
    ('Las Palmas',           'Santa Cruz de la Sierra', -17.8000000, -63.1700000),
    ('Zona Norte',           'Santa Cruz de la Sierra', -17.7400000, -63.1800000),
    ('Zona Sur',             'Santa Cruz de la Sierra', -17.8200000, -63.1750000),
    ('Zona Este',            'Santa Cruz de la Sierra', -17.7800000, -63.1500000),
    ('Zona Oeste',           'Santa Cruz de la Sierra', -17.7800000, -63.2100000),
    ('Plan 3000',            'Santa Cruz de la Sierra', -17.8100000, -63.1300000),
    ('Urbarí',               'Santa Cruz de la Sierra', -17.7700000, -63.2000000),
    ('Hamacas',              'Santa Cruz de la Sierra', -17.7500000, -63.1600000),
    ('Polanco',              'Santa Cruz de la Sierra', -17.7550000, -63.1700000),
    ('Sirari',               'Santa Cruz de la Sierra', -17.7650000, -63.1950000),
    ('La Morita',            'Santa Cruz de la Sierra', -17.7750000, -63.2050000),
    ('Radial 26',            'Santa Cruz de la Sierra', -17.7950000, -63.2000000),
    ('Santos Dumont',        'Santa Cruz de la Sierra', -17.7350000, -63.1750000),
    ('UV Pampa de la Isla',  'Santa Cruz de la Sierra', -17.8050000, -63.1600000),
    ('1er Anillo',           'Santa Cruz de la Sierra', -17.7830000, -63.1820000),
    ('2do Anillo',           'Santa Cruz de la Sierra', -17.7800000, -63.1850000),
    ('3er Anillo',           'Santa Cruz de la Sierra', -17.7750000, -63.1900000),
    ('4to Anillo',           'Santa Cruz de la Sierra', -17.7700000, -63.1950000),
    ('5to Anillo',           'Santa Cruz de la Sierra', -17.7650000, -63.2000000),
    ('6to Anillo',           'Santa Cruz de la Sierra', -17.7550000, -63.2050000),
    ('7mo Anillo',           'Santa Cruz de la Sierra', -17.7450000, -63.2100000),
    ('8vo Anillo',           'Santa Cruz de la Sierra', -17.7350000, -63.2150000),
    ('Villa 1ro de Mayo',    'Santa Cruz de la Sierra', -17.8150000, -63.1550000),
    ('Los Mangales',         'Santa Cruz de la Sierra', -17.7900000, -63.2100000),
    -- La Paz
    ('Sopocachi',            'La Paz',                  -16.5100000, -68.1300000),
    ('Calacoto',             'La Paz',                  -16.5400000, -68.0800000),
    ('Zona Sur',             'La Paz',                  -16.5350000, -68.0750000),
    ('Centro',               'La Paz',                  -16.4950000, -68.1350000),
    ('San Miguel',           'La Paz',                  -16.5250000, -68.0850000),
    ('Obrajes',              'La Paz',                  -16.5300000, -68.0900000),
    ('Miraflores',           'La Paz',                  -16.5050000, -68.1200000),
    ('Achumani',             'La Paz',                  -16.5450000, -68.0700000),
    ('Irpavi',               'La Paz',                  -16.5350000, -68.0650000),
    ('San Pedro',            'La Paz',                  -16.4950000, -68.1450000),
    ('Villa Fátima',         'La Paz',                  -16.4900000, -68.1150000),
    -- El Alto
    ('El Alto Centro',       'El Alto',                 -16.5100000, -68.1600000),
    ('Ceja',                 'El Alto',                 -16.5050000, -68.1650000),
    ('Satellite',            'El Alto',                 -16.5000000, -68.1700000),
    -- Cochabamba
    ('Cala Cala',            'Cochabamba',              -17.3700000, -66.1500000),
    ('Recoleta',             'Cochabamba',              -17.3900000, -66.1450000),
    ('Centro',               'Cochabamba',              -17.3900000, -66.1600000),
    ('Zona Norte',           'Cochabamba',              -17.3600000, -66.1550000),
    ('Zona Sur',             'Cochabamba',              -17.4200000, -66.1500000),
    ('Queru Queru',          'Cochabamba',              -17.3800000, -66.1650000),
    ('Sarco',                'Cochabamba',              -17.3850000, -66.1750000),
    ('Tiquipaya',            'Cochabamba',              -17.3400000, -66.2100000),
    ('Colcapirhua',          'Cochabamba',              -17.3950000, -66.2350000),
    -- Sucre
    ('Centro',               'Sucre',                   -19.0480000, -65.2590000),
    ('Zona Norte',           'Sucre',                   -19.0350000, -65.2600000),
    ('Zona Sur',             'Sucre',                   -19.0600000, -65.2550000),
    -- Tarija
    ('Centro',               'Tarija',                  -21.5355000, -64.7295000),
    ('Zona Norte',           'Tarija',                  -21.5200000, -64.7300000),
    ('Zona Sur',             'Tarija',                  -21.5500000, -64.7280000),
    -- Trinidad
    ('Centro',               'Trinidad',                -14.8333000, -64.9000000),
    -- Oruro
    ('Centro',               'Oruro',                   -17.9620000, -67.1060000),
    -- Potosí
    ('Centro',               'Potosí',                  -19.5880000, -65.7530000),
    -- Cobija
    ('Centro',               'Cobija',                  -11.0267000, -68.7692000)
ON CONFLICT (name, city) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Amenidades de propiedades
-- ---------------------------------------------------------------------------
INSERT INTO amenities (name, slug, icon, category, sort_order) VALUES
    ('Amoblado',          'amoblado',          'bed',            'interior',   1),
    ('Aire acondicionado','aire-acondicionado','snow',           'interior',   2),
    ('Calefacción',       'calefaccion',       'flame',          'interior',   3),
    ('Internet incluido', 'internet',          'wifi',           'interior',   4),
    ('Agua caliente',     'agua-caliente',     'water',          'interior',   5),
    ('Cocina equipada',   'cocina-equipada',   'restaurant',     'interior',   6),
    ('Lavandería',        'lavanderia',        'shirt',          'interior',   7),
    ('Piscina',           'piscina',           'water',          'exterior',  10),
    ('Jardín',            'jardin',            'leaf',           'exterior',  11),
    ('Balcón',            'balcon',            'sunny',          'exterior',  12),
    ('Terraza',           'terraza',           'umbrella',       'exterior',  13),
    ('Parrilla / BBQ',    'parrilla',          'bonfire',        'exterior',  14),
    ('Garaje',            'garaje',            'car',            'estacionamiento', 20),
    ('Estacionamiento',   'estacionamiento',   'car-sport',      'estacionamiento', 21),
    ('Ascensor',          'ascensor',          'arrow-up',       'edificio',  30),
    ('Seguridad 24h',     'seguridad-24h',     'shield-checkmark','edificio', 31),
    ('Portería',          'porteria',          'person',         'edificio',  32),
    ('Gimnasio',          'gimnasio',          'barbell',        'edificio',  33),
    ('Área de juegos',    'area-juegos',       'football',       'edificio',  34),
    ('Salón de eventos',  'salon-eventos',     'people',         'edificio',  35),
    ('Mascotas permitidas','mascotas',         'paw',            'politicas', 40),
    ('Apto para oficina', 'apto-oficina',      'briefcase',      'politicas', 41)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Planes de suscripción  (§11)
-- ---------------------------------------------------------------------------
INSERT INTO subscription_plans
    (name, slug, description, price, currency, duration_days,
     included_properties, extra_property_price,
     allows_featured, includes_statistics, priority_in_results, publication_duration_days, is_active)
VALUES
    ('Gratis',       'gratis',       'Publica tu primera propiedad gratis por 30 días (un solo uso).',
        0,   'USD', 30,  1,  3.99, FALSE, FALSE, FALSE, 30, TRUE),
    ('Básico',       'basico',       'Para vendedores ocasionales.',
        9.99,'USD', 30,  5,  1.99, FALSE, FALSE, FALSE, 30, TRUE),
    ('Profesional',  'profesional',  'Para agentes activos: más propiedades y estadísticas.',
        24.99,'USD',30,  20, 0.99, TRUE,  TRUE,  FALSE, 60, TRUE),
    ('Premium',      'premium',      'Máxima visibilidad: destacadas y prioridad en resultados.',
        49.99,'USD',30,  50, 0.49, TRUE,  TRUE,  TRUE,  90, TRUE)
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
