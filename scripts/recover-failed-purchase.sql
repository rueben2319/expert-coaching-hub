-- RECOVERY SCRIPT: Find and process failed credit purchase
-- This script finds transactions where payment was received but credits not added

-- Step 1: Find pending/failed transactions that might need recovery
-- Look for transactions with "pending" status but where payment actually succeeded
SELECT 
  t.id,
  t.transaction_ref,
  t.user_id,
  u.email,
  t.amount,
  t.currency,
  t.credits_amount,
  t.status,
  t.created_at,
  t.gateway_response,
  cw.balance as current_balance,
  cp.name as package_name
FROM transactions t
JOIN auth.users u ON t.user_id = u.id
JOIN credit_packages cp ON t.credit_package_id = cp.id
LEFT JOIN credit_wallets cw ON t.user_id = cw.user_id
WHERE t.transaction_mode = 'credit_purchase'
  AND t.status IN ('pending', 'failed')
  AND t.created_at > now() - interval '7 days'
ORDER BY t.created_at DESC;

-- Step 2: Check webhook processing log for this transaction
-- This will tell us if the webhook was received and what error occurred
SELECT 
  id,
  tx_ref,
  status,
  error_message,
  processed_at,
  payload
FROM webhook_processing_log
WHERE tx_ref IN (
  SELECT transaction_ref FROM transactions 
  WHERE transaction_mode = 'credit_purchase' 
    AND status IN ('pending', 'failed')
    AND created_at > now() - interval '7 days'
)
ORDER BY processed_at DESC;

-- Step 3: Manual recovery - EXECUTE ONLY IF PAYMENT WAS CONFIRMED
-- Replace {transaction_id} with the actual transaction ID from Step 1

-- First, get the transaction details
-- SELECT * FROM transactions WHERE id = '{transaction_id}';

-- Then update transaction status to success (if payment was confirmed)
-- BEGIN;
--   UPDATE transactions 
--   SET status = 'success',
--       gateway_response = jsonb_set(gateway_response, '{manual_recovery}', 'true')
--   WHERE id = '{transaction_id}';

--   -- Get transaction details for wallet update
--   WITH tx_data AS (
--     SELECT user_id, credits_amount FROM transactions WHERE id = '{transaction_id}'
--   ),
--   wallet_before AS (
--     SELECT balance FROM credit_wallets WHERE user_id = (SELECT user_id FROM tx_data)
--   )
--   UPDATE credit_wallets
--   SET balance = balance + (SELECT credits_amount FROM tx_data),
--       updated_at = now()
--   WHERE user_id = (SELECT user_id FROM tx_data);

--   -- Create credit transaction record
--   INSERT INTO credit_transactions (
--     user_id, transaction_type, amount, 
--     balance_before, balance_after,
--     reference_type, reference_id,
--     description, metadata, created_at
--   )
--   SELECT 
--     user_id, 
--     'purchase'::text,
--     credits_amount,
--     (SELECT balance FROM credit_wallets WHERE user_id = t.user_id) - t.credits_amount,
--     (SELECT balance FROM credit_wallets WHERE user_id = t.user_id),
--     'transaction'::text,
--     id,
--     'Purchased credits (manual recovery from failed webhook)',
--     jsonb_build_object('transaction_ref', transaction_ref, 'recovery', true),
--     now()
--   FROM (SELECT * FROM transactions WHERE id = '{transaction_id}') t;

-- COMMIT;
