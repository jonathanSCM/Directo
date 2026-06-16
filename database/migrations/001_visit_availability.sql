-- ============================================================================
--  Migración 001 — Disponibilidad de visitas por propiedad
--
--  El vendedor configura los días/horarios en que su propiedad puede recibir
--  visitas y cuántas visitas admite cada franja (capacity). Las solicitudes de
--  visita se validan contra estas reglas.
--
--  Aplicar:  psql -d inmobiliaria -f migrations/001_visit_availability.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS visit_availability (
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
COMMENT ON COLUMN visit_availability.weekday IS '0=domingo .. 6=sábado (coincide con Date.getUTCDay()).';
COMMENT ON COLUMN visit_availability.capacity IS 'Cantidad de visitas que admite cada franja horaria.';

CREATE INDEX IF NOT EXISTS idx_visit_availability_property
    ON visit_availability (property_id, weekday);

CREATE TRIGGER trg_visit_availability_updated_at
    BEFORE UPDATE ON visit_availability
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
