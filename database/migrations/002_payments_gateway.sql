-- ============================================================================
--  Migración 002 — Campos para pasarela de pagos
--
--  Deja la tabla payments lista para integrar una pasarela real:
--    * provider  — qué proveedor procesó el pago (manual, dlocal, stripe, ...).
--    * metadata  — payload/respuesta cruda del proveedor (jsonb).
--
--  Aplicar:  psql -d inmobiliaria -f migrations/002_payments_gateway.sql
-- ============================================================================

BEGIN;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NOT NULL DEFAULT 'manual';

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN payments.provider IS 'Proveedor que procesó el pago: manual, dlocal, stripe, paypal, etc.';
COMMENT ON COLUMN payments.metadata IS 'Respuesta/payload crudo del proveedor de pago.';

CREATE INDEX IF NOT EXISTS idx_payments_reference
    ON payments (transaction_reference);

COMMIT;
