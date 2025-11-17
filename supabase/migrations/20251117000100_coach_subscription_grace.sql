BEGIN;

-- Add grace period tracking columns
ALTER TABLE public.coach_subscriptions
  ADD COLUMN IF NOT EXISTS grace_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_renewal_attempts integer DEFAULT 0 NOT NULL;

-- Allow new status value
ALTER TABLE public.coach_subscriptions
  DROP CONSTRAINT IF EXISTS coach_subscriptions_status_check;

ALTER TABLE public.coach_subscriptions
  ADD CONSTRAINT coach_subscriptions_status_check CHECK (
    status = ANY (ARRAY['active', 'cancelled', 'expired', 'pending', 'grace'])
  );

-- Update status transition guard
CREATE OR REPLACE FUNCTION public.validate_subscription_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status NOT IN ('active', 'cancelled', 'expired', 'grace') THEN
    RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
  END IF;

  IF OLD.status = 'active' AND NEW.status NOT IN ('cancelled', 'expired', 'grace', 'active') THEN
    RAISE EXCEPTION 'Invalid status transition from active to %', NEW.status;
  END IF;

  IF OLD.status = 'grace' AND NEW.status NOT IN ('active', 'expired', 'cancelled', 'grace') THEN
    RAISE EXCEPTION 'Invalid status transition from grace to %', NEW.status;
  END IF;

  IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status from cancelled to %', NEW.status;
  END IF;

  IF OLD.status = 'expired' AND NEW.status NOT IN ('active', 'cancelled', 'grace') THEN
    RAISE EXCEPTION 'Invalid status transition from expired to %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

