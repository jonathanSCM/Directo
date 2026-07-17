-- Segmentación geográfica de anuncios: un anuncio puede apuntar a 0+ zonas.
-- Sin zonas = se muestra en cualquier sector (comportamiento actual).

BEGIN;

CREATE TABLE IF NOT EXISTS ad_zones (
  ad_id   UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  PRIMARY KEY (ad_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_zones_zone ON ad_zones (zone_id);

COMMIT;
