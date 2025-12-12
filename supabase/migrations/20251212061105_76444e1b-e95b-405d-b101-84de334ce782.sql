
-- Fix Security Definer Views by recreating with security_invoker = true
-- This ensures views respect RLS policies on underlying tables

-- 1. Fix certificate_verification view
DROP VIEW IF EXISTS public.certificate_verification;
CREATE VIEW public.certificate_verification
WITH (security_invoker = true)
AS
SELECT 
    cc.certificate_id,
    cc.issued_at,
    cc.expires_at,
    cc.verification_status,
    c.title AS course_title,
    p.full_name AS student_name,
    coach_profile.full_name AS coach_name,
    c.coach_id
FROM course_certificates cc
JOIN courses c ON cc.course_id = c.id
JOIN profiles p ON cc.user_id = p.id
JOIN profiles coach_profile ON c.coach_id = coach_profile.id
WHERE cc.verification_status = 'valid'::text;

-- 2. Fix profiles_public view (intentionally public, only non-sensitive fields)
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT 
    id,
    full_name,
    avatar_url,
    created_at,
    updated_at
FROM profiles;

-- 3. Fix stuck_withdrawals view (admin only)
DROP VIEW IF EXISTS public.stuck_withdrawals;
CREATE VIEW public.stuck_withdrawals
WITH (security_invoker = true)
AS
SELECT 
    id,
    coach_id,
    credits_amount,
    amount,
    payment_method,
    status,
    created_at,
    (EXTRACT(epoch FROM (now() - created_at)) / 3600::numeric) AS hours_processing,
    transaction_ref,
    rejection_reason
FROM withdrawal_requests
WHERE status::text = 'processing'::text 
AND created_at < (now() - '00:05:00'::interval)
ORDER BY created_at DESC;

-- 4. Fix v_practice_exercise_coach_scope view
DROP VIEW IF EXISTS public.v_practice_exercise_coach_scope;
CREATE VIEW public.v_practice_exercise_coach_scope
WITH (security_invoker = true)
AS
SELECT 
    pes.id AS set_id,
    c.coach_id,
    pes.generated_by
FROM practice_exercise_sets pes
LEFT JOIN lessons l ON l.id = pes.lesson_id
LEFT JOIN course_modules cm ON cm.id = l.module_id
LEFT JOIN courses c ON c.id = cm.course_id;

-- 5. Fix withdrawal_analytics view (admin only)
DROP VIEW IF EXISTS public.withdrawal_analytics;
CREATE VIEW public.withdrawal_analytics
WITH (security_invoker = true)
AS
SELECT 
    coach_id,
    count(*) AS total_requests,
    count(*) FILTER (WHERE status::text = 'completed'::text) AS completed_count,
    count(*) FILTER (WHERE status::text = 'failed'::text) AS failed_count,
    count(*) FILTER (WHERE status::text = 'processing'::text) AS processing_count,
    sum(credits_amount) AS total_credits_requested,
    sum(CASE WHEN status::text = 'completed'::text THEN credits_amount ELSE 0::numeric END) AS total_credits_withdrawn,
    avg(fraud_score) AS avg_fraud_score,
    max(created_at) AS last_request_at,
    min(created_at) AS first_request_at
FROM withdrawal_requests
GROUP BY coach_id;

-- Grant appropriate permissions
GRANT SELECT ON public.certificate_verification TO authenticated;
GRANT SELECT ON public.profiles_public TO authenticated, anon;
GRANT SELECT ON public.stuck_withdrawals TO authenticated;
GRANT SELECT ON public.v_practice_exercise_coach_scope TO authenticated;
GRANT SELECT ON public.withdrawal_analytics TO authenticated;
