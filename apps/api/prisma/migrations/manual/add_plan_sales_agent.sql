-- Planes que incluyen un asesor de ventas que gestiona la venta/alquiler de
-- las propiedades del dueño a cambio de una comisión, configurable por
-- operación (venta / alquiler / anticrético).
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS includes_sales_agent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS agent_commission_sale_pct DECIMAL(5,2);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS agent_commission_rent_pct DECIMAL(5,2);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS agent_commission_anticretico_pct DECIMAL(5,2);
