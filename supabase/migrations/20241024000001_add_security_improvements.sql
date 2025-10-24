-- Migration: Add security improvements for credit system
-- Description: Adds indexes for rate limiting and fraud detection queries
-- Date: 2024-10-24

-- Add indexes for faster rate limiting queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_coach_created 
  ON withdrawal_requests(coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created 
  ON withdrawal_requests(coach_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_mode_created 
  ON transactions(user_id, transaction_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
  ON transactions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type_created 
  ON credit_transactions(user_id, transaction_type, created_at DESC);

-- Add comments
COMMENT ON INDEX idx_withdrawal_requests_coach_created IS 
  'Optimizes rate limiting queries for withdrawal requests';

COMMENT ON INDEX idx_credit_transactions_user_type_created IS 
  'Optimizes credit aging and fraud detection queries';

CREATE OR REPLACE FUNCTION get_aged_credits(p_user_id UUID, p_min_age_days INTEGER DEFAULT 3)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  aging_date TIMESTAMPTZ := NOW() - (p_min_age_days || ' days')::INTERVAL;
  aged_net NUMERIC := 0;
  current_balance NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO aged_net
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND created_at <= aging_date; -- include positive and negative types

  SELECT COALESCE(balance,0)
  INTO current_balance
  FROM credit_wallets
  WHERE user_id = p_user_id;

  RETURN GREATEST(0, LEAST(aged_net, current_balance));
END;
$$;  

-- Add function to get aged credits (credits older than X days)
CREATE OR REPLACE FUNCTION get_aged_credits(
  p_user_id UUID,
  p_min_age_days INTEGER DEFAULT 3
)
RETURNS NUMERIC AS $$
DECLARE
  aging_date TIMESTAMPTZ;
  aged_amount NUMERIC;
BEGIN
  aging_date := NOW() - (p_min_age_days || ' days')::INTERVAL;
  
  SELECT COALESCE(SUM(amount), 0)
  INTO aged_amount
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND transaction_type IN ('purchase', 'course_earning', 'refund')
    AND created_at <= aging_date;
  
  RETURN aged_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_aged_credits IS 
  'Returns the amount of credits older than specified days (available for withdrawal)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_aged_credits TO authenticated;
GRANT EXECUTE ON FUNCTION get_aged_credits TO service_role;

-- Add metadata columns to withdrawal_requests for fraud tracking
ALTER TABLE withdrawal_requests 
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_reasons JSONB,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add comments
COMMENT ON COLUMN withdrawal_requests.fraud_score IS 
  'Automated fraud detection score (0-100, higher = more suspicious)';

COMMENT ON COLUMN withdrawal_requests.fraud_reasons IS 
  'Array of reasons contributing to fraud score';

-- Add view for withdrawal analytics
CREATE OR REPLACE VIEW withdrawal_analytics AS
SELECT 
  coach_id,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  SUM(credits_amount) as total_credits_requested,
  SUM(CASE WHEN status = 'completed' THEN credits_amount ELSE 0 END) as total_credits_withdrawn,
  AVG(fraud_score) as avg_fraud_score,
  MAX(created_at) as last_request_at,
  MIN(created_at) as first_request_at
FROM withdrawal_requests
GROUP BY coach_id;

-- Add comment
COMMENT ON VIEW withdrawal_analytics IS 
  'Aggregated withdrawal statistics per coach for monitoring';

-- Grant permissions
GRANT SELECT ON withdrawal_analytics TO authenticated;
GRANT SELECT ON withdrawal_analytics TO service_role;
