CREATE OR REPLACE FUNCTION "public"."process_withdrawal"("coach_id" "uuid", "credits_amount" integer, "amount_mwk" integer, "withdrawal_id" "uuid", "payout_ref" "text" DEFAULT NULL::"text", "payout_trans_id" "text" DEFAULT NULL::"text", "payment_method" "text" DEFAULT 'mobile_money'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  -- Update wallet balance and increment total_spent
  UPDATE credit_wallets
  SET balance = new_balance, 
      total_spent = COALESCE(total_spent, 0) + credits_amount,
      updated_at = now()
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
    processed_by = process_withdrawal.coach_id,
    transaction_ref = COALESCE(payout_trans_id, payout_ref)
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
$$;
