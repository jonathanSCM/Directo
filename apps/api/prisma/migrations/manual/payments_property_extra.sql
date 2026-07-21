-- Cobro puntual por "propiedad extra" (excede el cupo del plan): se reutiliza
-- la tabla payments (mismo flujo QR + comprobante + aprobación admin), solo
-- que en vez de subscription_id, el pago apunta a la propiedad que desbloquea.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS property_id UUID
  REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_property ON payments(property_id);
