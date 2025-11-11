-- Add retry tracking to withdrawal_requests table
ALTER TABLE withdrawal_requests
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_withdrawal_id UUID REFERENCES withdrawal_requests(id),
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_original_id 
ON withdrawal_requests(original_withdrawal_id) 
WHERE original_withdrawal_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN withdrawal_requests.retry_count IS 'Number of times this withdrawal has been retried (max 3)';
COMMENT ON COLUMN withdrawal_requests.original_withdrawal_id IS 'Reference to the original failed withdrawal if this is a retry';
COMMENT ON COLUMN withdrawal_requests.last_retry_at IS 'Timestamp of the last retry attempt';
