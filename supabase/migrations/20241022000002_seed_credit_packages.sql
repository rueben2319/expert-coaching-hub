-- Migration: Seed credit packages
-- Description: Creates the initial credit packages available for purchase
-- Date: 2024-10-22

-- Only insert if no packages exist (idempotent)
INSERT INTO public.credit_packages (
  name, 
  description, 
  credits, 
  bonus_credits, 
  price_mwk, 
  is_active, 
  sort_order
)
SELECT * FROM (VALUES
  (
    'Starter',
    'Perfect for trying out courses and getting started with your learning journey.',
    100,
    0,
    10000.00,
    true,
    1
  ),
  (
    'Basic',
    'Great for a few courses. Get 10 bonus credits!',
    250,
    10,
    24000.00,
    true,
    2
  ),
  (
    'Popular',
    'Most popular choice! Get 30 bonus credits and save more.',
    500,
    30,
    45000.00,
    true,
    3
  ),
  (
    'Premium',
    'Best value for serious learners. Get 100 bonus credits!',
    1000,
    100,
    85000.00,
    true,
    4
  ),
  (
    'Ultimate',
    'Maximum credits and maximum savings! Get 300 bonus credits.',
    2500,
    300,
    200000.00,
    true,
    5
  )
) AS v(name, description, credits, bonus_credits, price_mwk, is_active, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_packages WHERE name = v.name
);

-- Add comment
COMMENT ON TABLE public.credit_packages IS 'Available credit bundles users can purchase. Seeded with 5 default packages.';
