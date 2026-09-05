-- OAuth refresh replay protection and token rotation metadata
ALTER TABLE public.oauth_tokens
  ADD COLUMN IF NOT EXISTS last_refresh_request_id TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_last_refresh_request_id
  ON public.oauth_tokens(user_id, provider, last_refresh_request_id);
