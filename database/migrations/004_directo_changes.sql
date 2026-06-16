-- Migration 004: Directo app changes
-- 1. Rename user_role_mode: seller → owner
-- 2. Add users.free_trial_used flag
-- 3. Add properties.whatsapp and properties.contact_phone
-- 4. Drop visit_availability table (visits feature removed)
-- 5. Drop visit_requests dependencies handled by CASCADE

BEGIN;

-- 1. Rename enum value seller → owner
ALTER TYPE user_role_mode RENAME VALUE 'seller' TO 'owner';

-- 2. Add free trial flag to users
ALTER TABLE users ADD COLUMN free_trial_used BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Add contact fields to properties
ALTER TABLE properties ADD COLUMN whatsapp VARCHAR(30);
ALTER TABLE properties ADD COLUMN contact_phone VARCHAR(30);

-- 4. Drop visits tables (feature removed per new spec)
DROP TABLE IF EXISTS visit_requests CASCADE;
DROP TABLE IF EXISTS visit_availability CASCADE;

-- 5. Drop conversations and messages tables (chat removed per new spec)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- 6. Drop visit_request_status enum (no longer needed)
DROP TYPE IF EXISTS visit_request_status;

COMMIT;
