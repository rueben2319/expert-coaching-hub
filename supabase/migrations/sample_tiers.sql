-- Insert sample tiers for testing
INSERT INTO public.tiers (name, description, price_monthly, price_yearly, features, max_courses, max_students, is_active) VALUES
('Starter', 'Basic features for new coaches', 10.00, 100.00, '["1 course", "Basic analytics", "Email support"]'::jsonb, 1, 5, true),
('Pro', 'Most popular plan for growing coaches', 30.00, 300.00, '["10 courses", "Advanced analytics", "Priority support", "Custom branding"]'::jsonb, 10, 50, true),
('Premium', 'All features for professional coaches', 100.00, 1000.00, '["Unlimited courses", "Advanced analytics", "24/7 support", "White-label platform", "API access"]'::jsonb, null, null, true);
