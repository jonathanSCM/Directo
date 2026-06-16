-- ============================================================================
--  Migración 003 — Tipo de notificación "promotion"
--
--  Agrega el valor 'promotion' al enum notification_type para soportar
--  notificaciones de publicidad / marketing in-app (§14).
--
--  Nota: ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de una
--  transacción que además use el valor; se ejecuta en autocommit.
--
--  Aplicar:  psql -d inmobiliaria -f migrations/003_notification_promotion.sql
-- ============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'promotion';
