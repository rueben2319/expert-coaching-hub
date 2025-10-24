-- Create atomic withdrawal processing function
CREATE OR REPLACE FUNCTION process_withdrawal(
  coach_id uuid,
  credits_amount integer,
  amount_mwk integer,
  withdrawal_id uuid,
  payout_ref text DEFAULT NULL,
  payout_trans_id text DEFAULT NULL,
  payment_method text DEFAULT 'mobile_money'
)
RETURNS json AS $$
DECLARE
  wallet_record record;
  new_balance integer;
  transaction_id uuid;
BEGIN
  -- Start transaction
  -- Get current wallet balance with row lock
  SELECT * INTO wallet_record
  FROM credit_wallets
  WHERE user_id = coach_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', coach_id;
  END IF;

  -- Check sufficient balance
  IF wallet_record.balance < credits_amount THEN
    RAISE EXCEPTION 'Insufficient balance: % < %', wallet_record.balance, credits_amount;
  END IF;

  -- Calculate new balance
  new_balance := wallet_record.balance - credits_amount;

  -- Update wallet balance
  UPDATE credit_wallets
  SET balance = new_balance, updated_at = now()
  WHERE user_id = coach_id;

  -- Insert transaction record
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    coach_id,
    'withdrawal',
    -credits_amount,
    wallet_record.balance,
    new_balance,
    'withdrawal_request',
    withdrawal_id,
    format('Immediate withdrawal: %s credits → %s MWK via PayChangu', credits_amount, amount_mwk),
    json_build_object(
      'payment_method', payment_method,
      'amount_mwk', amount_mwk,
      'payout_ref', payout_ref,
      'payout_trans_id', payout_trans_id
    )
  ) RETURNING id INTO transaction_id;

  -- Update withdrawal request status
  UPDATE withdrawal_requests
  SET
    status = 'completed',
    processed_at = now(),
    processed_by = coach_id
  WHERE id = withdrawal_id;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'new_balance', new_balance,
    'transaction_id', transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automatically happens
    RAISE EXCEPTION 'Withdrawal processing failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create refund function for failed withdrawals
CREATE OR REPLACE FUNCTION refund_failed_withdrawal(
  coach_id uuid,
  credits_amount integer,
  withdrawal_id uuid
)
RETURNS json AS $$
DECLARE
  wallet_record record;
  new_balance integer;
  transaction_id uuid;
BEGIN
  -- Get current wallet balance
  SELECT * INTO wallet_record
  FROM credit_wallets
  WHERE user_id = coach_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', coach_id;
  END IF;

  -- Calculate new balance (refund)
  new_balance := wallet_record.balance + credits_amount;

  -- Update wallet balance
  UPDATE credit_wallets
  SET balance = new_balance, updated_at = now()
  WHERE user_id = coach_id;

  -- Insert refund transaction record
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    coach_id,
    'refund',
    credits_amount,
    wallet_record.balance,
    new_balance,
    'withdrawal_request',
    withdrawal_id,
    format('Refund for failed withdrawal: %s credits', credits_amount),
    json_build_object(
      'refund_reason', 'withdrawal_failure',
      'original_credits', credits_amount
    )
  ) RETURNING id INTO transaction_id;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'new_balance', new_balance,
    'transaction_id', transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Refund processing failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
