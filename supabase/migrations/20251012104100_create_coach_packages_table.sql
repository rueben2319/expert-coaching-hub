-- Create coach_packages table for coach-created subscription packages
CREATE TABLE public.coach_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_clients INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create client_subscriptions table for clients subscribing to coach packages
CREATE TABLE public.client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.coach_packages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  renewal_date TIMESTAMPTZ,
  transaction_id TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coach_packages
CREATE POLICY "Coaches can view their own packages"
  ON public.coach_packages FOR SELECT
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can create their own packages"
  ON public.coach_packages FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can update their own packages"
  ON public.coach_packages FOR UPDATE
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active coach packages"
  ON public.coach_packages FOR SELECT
  USING (is_active = true);

-- RLS Policies for client_subscriptions
CREATE POLICY "Clients can view their own subscriptions"
  ON public.client_subscriptions FOR SELECT
  USING (client_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view subscriptions to their packages"
  ON public.client_subscriptions FOR SELECT
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can create subscriptions"
  ON public.client_subscriptions FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "System can update subscriptions"
  ON public.client_subscriptions FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR coach_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_coach_packages_coach_id ON public.coach_packages(coach_id);
CREATE INDEX idx_coach_packages_active ON public.coach_packages(is_active);
CREATE INDEX idx_client_subscriptions_client_id ON public.client_subscriptions(client_id);
CREATE INDEX idx_client_subscriptions_coach_id ON public.client_subscriptions(coach_id);
CREATE INDEX idx_client_subscriptions_package_id ON public.client_subscriptions(package_id);
CREATE INDEX idx_client_subscriptions_status ON public.client_subscriptions(status);

-- Create trigger for updated_at
CREATE TRIGGER update_coach_packages_updated_at
  BEFORE UPDATE ON public.coach_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_client_subscriptions_updated_at
  BEFORE UPDATE ON public.client_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
