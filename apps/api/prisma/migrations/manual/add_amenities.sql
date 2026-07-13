-- Add amenities catalog + property_amenities join table

CREATE TABLE IF NOT EXISTS amenities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  slug       CITEXT        NOT NULL UNIQUE,
  icon       VARCHAR(50)   NOT NULL DEFAULT 'star',
  category   VARCHAR(50)   NOT NULL DEFAULT 'general',
  is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order INT           NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_amenities (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amenity_id  UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, amenity_id)
);

CREATE INDEX IF NOT EXISTS idx_property_amenities_property ON property_amenities (property_id);
CREATE INDEX IF NOT EXISTS idx_property_amenities_amenity  ON property_amenities (amenity_id);
CREATE INDEX IF NOT EXISTS idx_amenities_active            ON amenities (is_active);

-- Also add 'admin' sender type for support messages (admin can reply to owner tickets)
ALTER TYPE support_message_sender ADD VALUE IF NOT EXISTS 'admin';
