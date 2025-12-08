-- Remove the paychangu_secret_key column from coach_settings table
-- This column stores sensitive payment API keys in plain text which is a security risk
-- The payment integration is not currently active, so this column is not needed

ALTER TABLE public.coach_settings DROP COLUMN IF EXISTS paychangu_secret_key;

-- Also remove the vault reference column since we're removing the feature entirely
ALTER TABLE public.coach_settings DROP COLUMN IF EXISTS paychangu_key_vault_id;