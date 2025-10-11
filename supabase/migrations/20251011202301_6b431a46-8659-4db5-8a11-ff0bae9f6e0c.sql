-- Create tiers table for platform subscription plans
CREATE TABLE public.tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_courses INTEGER,
  max_students INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create coach_subscriptions table
CREATE TABLE public.coach_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  tier_id UUID NOT NULL REFERENCES public.tiers(id) ON DELETE RESTRICT,
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

-- Create client_orders table
CREATE TABLE public.client_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('one_time', 'monthly', 'yearly')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.client_orders(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.coach_subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_ref TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  gateway_response JSONB,
  order_id UUID REFERENCES public.client_orders(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.coach_subscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tiers
CREATE POLICY "Everyone can view active tiers"
  ON public.tiers FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage tiers"
  ON public.tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for coach_subscriptions
CREATE POLICY "Coaches can view their own subscriptions"
  ON public.coach_subscriptions FOR SELECT
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can insert their own subscriptions"
  ON public.coach_subscriptions FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can update their own subscriptions"
  ON public.coach_subscriptions FOR UPDATE
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS Policies for client_orders
CREATE POLICY "Users can view their own orders"
  ON public.client_orders FOR SELECT
  USING (client_id = auth.uid() OR coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can create orders"
  ON public.client_orders FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "System can update orders"
  ON public.client_orders FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR client_id = auth.uid());

-- RLS Policies for invoices
CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage invoices"
  ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update transactions"
  ON public.transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_coach_subscriptions_coach_id ON public.coach_subscriptions(coach_id);
CREATE INDEX idx_coach_subscriptions_status ON public.coach_subscriptions(status);
CREATE INDEX idx_client_orders_client_id ON public.client_orders(client_id);
CREATE INDEX idx_client_orders_coach_id ON public.client_orders(coach_id);
CREATE INDEX idx_client_orders_status ON public.client_orders(status);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_ref ON public.transactions(transaction_ref);

-- Create trigger for updated_at
CREATE TRIGGER update_tiers_updated_at
  BEFORE UPDATE ON public.tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_coach_subscriptions_updated_at
  BEFORE UPDATE ON public.coach_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_client_orders_updated_at
  BEFORE UPDATE ON public.client_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  new_number := year_prefix || '-' || LPAD(NEXTVAL('invoice_sequence')::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_sequence START 1;

-- Insert default tiers
INSERT INTO public.tiers (name, description, price_monthly, price_yearly, features, max_courses, max_students) VALUES
  ('Starter', 'Perfect for getting started', 15000, 150000, '["Up to 5 courses", "Up to 50 students", "Basic analytics", "Email support"]'::jsonb, 5, 50),
  ('Pro', 'For growing coaches', 35000, 350000, '["Up to 20 courses", "Up to 200 students", "Advanced analytics", "Priority support", "Custom branding"]'::jsonb, 20, 200),
  ('Premium', 'For professional coaches', 70000, 700000, '["Unlimited courses", "Unlimited students", "Advanced analytics", "24/7 support", "Custom branding", "API access", "White label"]'::jsonb, NULL, NULL);