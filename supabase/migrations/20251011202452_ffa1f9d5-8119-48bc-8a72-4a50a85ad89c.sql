-- Fix search_path for generate_invoice_number function
DROP FUNCTION IF EXISTS public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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