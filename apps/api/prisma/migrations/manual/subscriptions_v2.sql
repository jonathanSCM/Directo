-- Suscripciones v2: planes por tiempo + propiedades incluidas/extra,
-- renovación sin corte, plan gratis de un solo uso.

BEGIN;

-- 1. Planes: propiedades incluidas + precio por propiedad extra
ALTER TABLE subscription_plans RENAME COLUMN max_active_properties TO included_properties;
ALTER TABLE subscription_plans ADD COLUMN extra_property_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS max_images_per_property;

-- Planes con propiedades "ilimitadas" (NULL) pasan a un número concreto base
UPDATE subscription_plans SET included_properties = 1 WHERE included_properties IS NULL AND price = 0;
UPDATE subscription_plans SET included_properties = 10 WHERE included_properties IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN included_properties SET NOT NULL;
ALTER TABLE subscription_plans ALTER COLUMN included_properties SET DEFAULT 1;

-- 2. Suscripciones: cantidad de propiedades compradas + vínculo de renovación
ALTER TABLE subscriptions ADD COLUMN property_count INT;
ALTER TABLE subscriptions ADD COLUMN renews_subscription_id UUID
  REFERENCES subscriptions(id) ON DELETE SET NULL;

-- Backfill: las suscripciones existentes heredan las incluidas de su plan
UPDATE subscriptions s SET property_count = p.included_properties
FROM subscription_plans p WHERE s.plan_id = p.id AND s.property_count IS NULL;

-- 3. Limpieza previa al índice único: si un usuario tiene varias filas
-- vigentes (active/pending_payment), se conserva la más reciente
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id ORDER BY created_at DESC
  ) AS rn
  FROM subscriptions WHERE status IN ('active', 'pending_payment')
)
UPDATE subscriptions SET status = 'cancelled', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Una sola suscripción vigente por usuario (cierra condiciones de carrera)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_current_per_user
  ON subscriptions (user_id) WHERE status IN ('active', 'pending_payment');

-- 4. Plan gratis de un solo uso: quien ya tuvo un plan de precio 0
-- (incluida la prueba trial-30) queda marcado como usado
UPDATE users u SET free_trial_used = TRUE
WHERE EXISTS (
  SELECT 1 FROM subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.user_id = u.id AND p.price = 0
);

-- El plan oculto de prueba deja de existir como opción (si no tiene
-- suscripciones se podría borrar, pero desactivarlo es suficiente y seguro)
UPDATE subscription_plans SET is_active = FALSE WHERE slug = 'trial-30';

COMMIT;
