-- Planes marcados con esta bandera hacen que las propiedades de sus dueños
-- salgan siempre con el marcador PRO en el mapa (sin importar venta/alquiler/anticrético).
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS use_pro_marker BOOLEAN NOT NULL DEFAULT FALSE;
