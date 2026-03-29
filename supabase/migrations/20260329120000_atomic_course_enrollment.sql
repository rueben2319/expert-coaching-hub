CREATE OR REPLACE FUNCTION public.enroll_with_credits_atomic(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_course public.courses%ROWTYPE;
  v_buyer_wallet public.credit_wallets%ROWTYPE;
  v_coach_wallet public.credit_wallets%ROWTYPE;
  v_enrollment_id uuid;
  v_sender_transaction_id uuid;
  v_receiver_transaction_id uuid;
  v_price numeric(10,2);
BEGIN
  PERFORM set_config('transaction_isolation', 'serializable', true);

  SELECT *
  INTO v_course
  FROM public.courses
  WHERE id = p_course_id
  FOR UPDATE;

  IF NOT FOUND OR v_course.status <> 'published' THEN
    RAISE EXCEPTION 'Course not purchasable';
  END IF;

  IF v_course.coach_id IS NULL THEN
    RAISE EXCEPTION 'Course owner not found';
  END IF;

  IF v_course.coach_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot enroll in your own course';
  END IF;

  v_price := COALESCE(v_course.price_credits, 0);

  BEGIN
    INSERT INTO public.course_enrollments (
      user_id,
      course_id,
      credits_paid,
      payment_status
    )
    VALUES (
      p_user_id,
      p_course_id,
      CASE WHEN COALESCE(v_course.is_free, false) OR v_price <= 0 THEN 0 ELSE v_price END,
      CASE WHEN COALESCE(v_course.is_free, false) OR v_price <= 0 THEN 'free' ELSE 'paid' END
    )
    RETURNING id INTO v_enrollment_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Already enrolled in this course';
  END;

  IF COALESCE(v_course.is_free, false) OR v_price <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'enrollment_id', v_enrollment_id,
      'payment_status', 'free',
      'credits_paid', 0,
      'transaction_id', NULL
    );
  END IF;

  SELECT *
  INTO v_buyer_wallet
  FROM public.credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buyer wallet not found';
  END IF;

  SELECT *
  INTO v_coach_wallet
  FROM public.credit_wallets
  WHERE user_id = v_course.coach_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course owner wallet not found';
  END IF;

  IF v_buyer_wallet.balance < v_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.credit_wallets
  SET
    balance = balance - v_price,
    total_spent = total_spent + v_price,
    updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE public.credit_wallets
  SET
    balance = balance + v_price,
    total_earned = total_earned + v_price,
    updated_at = now()
  WHERE user_id = v_course.coach_id;

  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    'course_payment',
    -v_price,
    v_buyer_wallet.balance,
    v_buyer_wallet.balance - v_price,
    'course_enrollment',
    p_course_id,
    format('Course enrollment payment: %s', v_course.title),
    jsonb_build_object(
      'course_id', p_course_id,
      'course_title', v_course.title,
      'counterparty_user_id', v_course.coach_id,
      'immutable', true
    )
  )
  RETURNING id INTO v_sender_transaction_id;

  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  )
  VALUES (
    v_course.coach_id,
    'course_earning',
    v_price,
    v_coach_wallet.balance,
    v_coach_wallet.balance + v_price,
    'course_enrollment',
    p_course_id,
    format('Course enrollment earning: %s', v_course.title),
    jsonb_build_object(
      'course_id', p_course_id,
      'course_title', v_course.title,
      'counterparty_user_id', p_user_id,
      'immutable', true
    )
  )
  RETURNING id INTO v_receiver_transaction_id;

  UPDATE public.course_enrollments
  SET credit_transaction_id = v_sender_transaction_id
  WHERE id = v_enrollment_id;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'payment_status', 'paid',
    'credits_paid', v_price,
    'transaction_id', v_sender_transaction_id,
    'receiver_transaction_id', v_receiver_transaction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_with_credits_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_with_credits_atomic(uuid, uuid) TO service_role;
