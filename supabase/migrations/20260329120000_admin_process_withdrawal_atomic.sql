CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_withdrawal_id uuid,
  p_action text,
  p_admin_id uuid,
  p_admin_notes text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wr record;
  process_result json;
  resulting_status text;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Action must be approve or reject';
  END IF;

  SELECT id, coach_id, credits_amount, amount_mwk, status
  INTO wr
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF wr.status <> 'pending' THEN
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'withdrawal_id', p_withdrawal_id,
      'status', wr.status,
      'message', format('Withdrawal already processed with status %s', wr.status)
    );
  END IF;

  IF p_action = 'approve' THEN
    process_result := process_withdrawal(
      wr.coach_id,
      wr.credits_amount,
      wr.amount_mwk,
      p_withdrawal_id,
      NULL,
      NULL,
      'mobile_money'
    );

    UPDATE withdrawal_requests
    SET processed_by = p_admin_id,
        admin_notes = COALESCE(p_admin_notes, admin_notes)
    WHERE id = p_withdrawal_id;

    resulting_status := 'completed';
  ELSE
    UPDATE withdrawal_requests
    SET status = 'failed',
        processed_at = now(),
        processed_by = p_admin_id,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        rejection_reason = COALESCE(p_admin_notes, rejection_reason, 'Rejected by admin')
    WHERE id = p_withdrawal_id;

    resulting_status := 'failed';
  END IF;

  INSERT INTO security_audit_log (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'withdrawal_processed',
    p_admin_id,
    wr.coach_id,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id,
      'action', p_action,
      'status', resulting_status
    )
  );

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'withdrawal_id', p_withdrawal_id,
    'status', resulting_status,
    'message', format('Withdrawal %s successfully', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, text, uuid, text) TO service_role;
