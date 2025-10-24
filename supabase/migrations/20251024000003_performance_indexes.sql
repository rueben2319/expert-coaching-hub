-- Add indexes for better performance on rate limiting and fraud detection queries

-- Index for rate limiting queries: (user_id, transaction_mode, created_at)
-- This optimizes the count query in purchase-credits function
CREATE INDEX IF NOT EXISTS idx_transactions_rate_limit
ON transactions (user_id, transaction_mode, created_at DESC)
WHERE transaction_mode = 'credit_purchase';

-- Index for withdrawal rate limiting: (coach_id, created_at)
-- This optimizes the count query in immediate-withdrawal function
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_rate_limit
ON withdrawal_requests (coach_id, created_at DESC)
WHERE status IN ('completed', 'processing');

-- Index for fraud detection: (user_id, transaction_mode, status, created_at)
-- This optimizes the fraud check query in purchase-credits function
CREATE INDEX IF NOT EXISTS idx_transactions_fraud_check
ON transactions (user_id, transaction_mode, status, created_at DESC)
WHERE transaction_mode = 'credit_purchase' AND status = 'success';

-- Index for credit aging checks: (user_id, created_at)
-- This optimizes the credit aging query in immediate-withdrawal function
CREATE INDEX IF NOT EXISTS idx_credit_transactions_aging
ON credit_transactions (user_id, created_at DESC)
WHERE transaction_type IN ('purchase', 'course_earning', 'refund');
