-- Migration to fix stuck withdrawals
-- This migration adds a helper function to identify and manage stuck withdrawals

-- Create a function to check and potentially mark old processing withdrawals
CREATE OR REPLACE FUNCTION mark_old_processing_withdrawals_as_pending()
RETURNS TABLE (
  withdrawal_id UUID,
  old_status TEXT,
  new_status TEXT,
  hours_processing NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  UPDATE withdrawal_requests
  SET status = 'pending'
  WHERE 
    status = 'processing' 
    AND created_at < NOW() - INTERVAL '24 hours'
    AND transaction_ref IS NOT NULL
  RETURNING 
    id,
    'processing'::TEXT,
    'pending'::TEXT,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600;
END;
$$ LANGUAGE plpgsql;

-- Create a view to identify stuck withdrawals
CREATE OR REPLACE VIEW stuck_withdrawals AS
SELECT 
  id,
  coach_id,
  credits_amount,
  amount,
  payment_method,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_processing,
  transaction_ref,
  rejection_reason
FROM withdrawal_requests
WHERE 
  status = 'processing' 
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- Add comment to the view
COMMENT ON VIEW stuck_withdrawals IS 'View to identify withdrawals stuck in processing status for more than 5 minutes';

-- Create an index for better performance on status and created_at queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created_at 
ON withdrawal_requests(status, created_at DESC);

-- Create an index for transaction_ref lookups
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_transaction_ref 
ON withdrawal_requests(transaction_ref) 
WHERE transaction_ref IS NOT NULL;
