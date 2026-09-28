-- Codigo de verificacion de correo al registrarse (distinto de `is_verified`,
-- que es la insignia de confianza que pone el admin a mano). El estado
-- "verificado" se guarda en `email_verified_at`, que ya existia (antes solo
-- lo llenaba el login con Google).
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
