-- Clics reales en publicidad (antes solo se contaban "vistas servidas").
ALTER TABLE ads ADD COLUMN IF NOT EXISTS clicks_used INT NOT NULL DEFAULT 0;

-- Clics en "contactar por WhatsApp" por propiedad, para estadisticas del dueno.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS contacts_count INT NOT NULL DEFAULT 0;

-- Log de busquedas/navegacion en /properties, para analitica de demanda
-- (zonas y filtros mas buscados, busquedas con 0 resultados).
CREATE TABLE IF NOT EXISTS search_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,
  zone_id       UUID,
  city          VARCHAR(100),
  operation     VARCHAR(20),
  min_price     DECIMAL(12,2),
  max_price     DECIMAL(12,2),
  bedrooms      INT,
  query_text    TEXT,
  results_count INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_events_date ON search_events (created_at);
CREATE INDEX IF NOT EXISTS idx_search_events_zone ON search_events (zone_id);
