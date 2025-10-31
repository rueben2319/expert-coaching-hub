-- Security fixes: enforce stable search_path and set view as security invoker

-- Ensure the analytics view runs with caller's privileges
ALTER VIEW public.withdrawal_analytics SET (security_invoker = true);

-- Functions: set explicit search_path to avoid role-mutable behavior
ALTER FUNCTION public.validate_transaction_status_transition()
  SET search_path TO public;

ALTER FUNCTION public.validate_subscription_status_transition()
  SET search_path TO public;

ALTER FUNCTION public.calculate_renewal_date(text, timestamptz)
  SET search_path TO public;

ALTER FUNCTION public.transfer_credits(uuid, uuid, numeric, character varying, character varying, uuid, text, jsonb)
  SET search_path TO public;

ALTER FUNCTION public.process_withdrawal(uuid, integer, integer, uuid, text, text, text)
  SET search_path TO public;

ALTER FUNCTION public.refund_failed_withdrawal(uuid, integer, uuid)
  SET search_path TO public;

ALTER FUNCTION public.get_available_withdrawable_credits(uuid, integer)
  SET search_path TO public;

ALTER FUNCTION public.get_aged_credits(uuid, integer)
  SET search_path TO public;

ALTER FUNCTION public.log_subscription_status_change()
  SET search_path TO public;


