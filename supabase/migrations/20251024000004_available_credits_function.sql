-- Create function to calculate available withdrawable credits with aging
CREATE OR REPLACE FUNCTION get_available_withdrawable_credits(
  user_id_param uuid,
  credit_aging_days_param integer
)
RETURNS integer AS $$
DECLARE
  current_balance integer;
  aged_credits integer;
  aging_date timestamp with time zone;
BEGIN
  -- Get current wallet balance
  SELECT balance INTO current_balance
  FROM credit_wallets
  WHERE user_id = user_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', user_id_param;
  END IF;

  -- Calculate aging cutoff date
  aging_date := now() - interval '1 day' * credit_aging_days_param;

  -- Get sum of aged credits (credits earned before aging period)
  SELECT COALESCE(SUM(amount), 0) INTO aged_credits
  FROM credit_transactions
  WHERE user_id = user_id_param
    AND transaction_type IN ('purchase', 'course_earning', 'refund')
    AND created_at <= aging_date;

  -- Available for withdrawal is the minimum of aged credits and current balance
  -- (to prevent negative results if calculations are off)
  RETURN GREATEST(LEAST(aged_credits, current_balance), 0);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to calculate available withdrawable credits: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
