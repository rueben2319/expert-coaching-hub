-- Create coach settings table for payment integrations
CREATE TABLE public.coach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paychangu_secret_key TEXT,
  paychangu_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coach_id)
);

-- Enable RLS
ALTER TABLE public.coach_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Coaches can view their own settings"
  ON public.coach_settings FOR SELECT
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can update their own settings"
  ON public.coach_settings FOR UPDATE
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can insert their own settings"
  ON public.coach_settings FOR INSERT
  WITH CHECK (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Function to get coach's PayChangu secret (returns NULL if not configured)
CREATE OR REPLACE FUNCTION public.get_coach_paychangu_secret(_coach_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_key TEXT;
BEGIN
  SELECT paychangu_secret_key INTO secret_key
  FROM public.coach_settings
  WHERE coach_id = _coach_id
    AND paychangu_enabled = true;

  RETURN secret_key;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_coach_settings_updated_at
  BEFORE UPDATE ON public.coach_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
