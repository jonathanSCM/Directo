-- Permite elegir si un anuncio se muestra como banner (tarjeta chica inline)
-- o como popup (modal a pantalla completa al entrar a Explorar), o ambos.
ALTER TABLE ads ADD COLUMN IF NOT EXISTS placement VARCHAR(10) NOT NULL DEFAULT 'both';
