-- Publicidad para empresas: plan empresas (tiempo + vistas), empresa por
-- usuario y anuncios con imagen + link que se sirven en popup y detalle.

BEGIN;

-- Planes de empresa: bandera + cupo de vistas de publicidad incluidas
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_business BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS ad_views INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  website    TEXT,
  logo_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title           VARCHAR(120) NOT NULL,
  image_url       TEXT NOT NULL,
  link_url        TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active | paused
  views_purchased INT NOT NULL DEFAULT 0,
  views_used      INT NOT NULL DEFAULT 0,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_company ON ads (company_id);
-- Índice para el sorteo de anuncios elegibles
CREATE INDEX IF NOT EXISTS idx_ads_serving ON ads (status, ends_at);

-- Plan Empresas inicial
INSERT INTO subscription_plans
  (name, slug, description, price, currency, duration_days,
   included_properties, extra_property_price,
   allows_featured, includes_statistics, priority_in_results,
   is_business, ad_views, is_active)
VALUES
  ('Empresas', 'empresas',
   'Publicidad de tu empresa en la app y la web: popup de entrada y espacios en los detalles de propiedades, con link a tu sitio.',
   79.99, 'USD', 30, 1, 0, FALSE, TRUE, FALSE, TRUE, 10000, TRUE)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
