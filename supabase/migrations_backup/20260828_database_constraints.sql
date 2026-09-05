-- =====================================================================
-- DATABASE CONSTRAINTS AND INDEXES
-- Date: 2026-08-28
-- Purpose: Add unique constraints, check constraints, and composite indexes
-- Security: Improves data integrity and prevents business logic violations
-- =====================================================================

-- =====================================================================
-- UNIQUE CONSTRAINTS
-- =====================================================================

-- Prevent duplicate enrollments for same user in same course
ALTER TABLE public.course_enrollments 
  DROP CONSTRAINT IF EXISTS course_enrollments_user_course_unique;

ALTER TABLE public.course_enrollments 
  ADD CONSTRAINT course_enrollments_user_course_unique 
  UNIQUE (user_id, course_id);

-- Prevent duplicate reviews from same user for same course
ALTER TABLE public.course_reviews 
  DROP CONSTRAINT IF EXISTS course_reviews_user_course_unique;

ALTER TABLE public.course_reviews 
  ADD CONSTRAINT course_reviews_user_course_unique 
  UNIQUE (user_id, course_id);

-- Prevent duplicate certificates for same user in same course
ALTER TABLE public.course_certificates 
  DROP CONSTRAINT IF EXISTS course_certificates_user_course_unique;

ALTER TABLE public.course_certificates 
  ADD CONSTRAINT course_certificates_user_course_unique 
  UNIQUE (user_id, course_id);

-- Ensure unique certificate IDs
ALTER TABLE public.course_certificates 
  ADD CONSTRAINT course_certificates_certificate_id_unique 
  UNIQUE (certificate_id);

-- Prevent duplicate withdrawal requests with same reference
ALTER TABLE public.withdrawal_requests 
  DROP CONSTRAINT IF EXISTS withdrawal_requests_ref_unique;

ALTER TABLE public.withdrawal_requests 
  ADD CONSTRAINT withdrawal_requests_ref_unique 
  UNIQUE (transaction_ref);

-- Ensure unique transaction references
ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_ref_unique;

ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_ref_unique 
  UNIQUE (transaction_ref);

-- Ensure unique invoice numbers
ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS invoices_number_unique;

ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_number_unique 
  UNIQUE (invoice_number);

-- =====================================================================
-- CHECK CONSTRAINTS
-- =====================================================================

-- Ensure credits are never negative
ALTER TABLE public.credit_wallets 
  ADD CONSTRAINT credit_wallets_balance_non_negative 
  CHECK (balance >= 0);

-- Ensure transaction amounts are valid
ALTER TABLE public.credit_transactions 
  ADD CONSTRAINT credit_transactions_amount_valid 
  CHECK (
    amount != 0 AND 
    balance_before >= 0 AND 
    balance_after >= 0 AND
    transaction_type IN ('purchase', 'course_payment', 'course_earning', 'refund', 'bonus', 'withdrawal', 'deposit')
  );

-- Ensure withdrawal amounts are positive
ALTER TABLE public.withdrawal_requests 
  ADD CONSTRAINT withdrawal_requests_amount_positive 
  CHECK (credits_amount > 0 AND amount_mwk > 0);

-- Ensure progress percentage is valid
ALTER TABLE public.course_enrollments 
  ADD CONSTRAINT course_enrollments_progress_valid 
  CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Ensure lesson progress is valid
ALTER TABLE public.lesson_progress 
  ADD CONSTRAINT lesson_progress_percentage_valid 
  CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Ensure order_index is non-negative where used
ALTER TABLE public.course_modules 
  ADD CONSTRAINT course_modules_order_index_valid 
  CHECK (order_index IS NULL OR order_index >= 0);

ALTER TABLE public.lessons 
  ADD CONSTRAINT lessons_order_index_valid 
  CHECK (order_index IS NULL OR order_index >= 0);

ALTER TABLE public.lesson_content 
  ADD CONSTRAINT lesson_content_order_index_valid 
  CHECK (order_index IS NULL OR order_index >= 0);

-- Ensure file sizes are positive
ALTER TABLE public.course_files 
  ADD CONSTRAINT course_files_size_positive 
  CHECK (file_size IS NULL OR file_size > 0);

-- Ensure rating is within valid range
ALTER TABLE public.courses 
  ADD CONSTRAINT courses_rating_valid 
  CHECK (average_rating IS NULL OR (average_rating >= 0 AND average_rating <= 5));

-- =====================================================================
-- COMPOSITE INDEXES FOR PERFORMANCE
-- =====================================================================

-- Course enrollment queries
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_status 
  ON public.course_enrollments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_status 
  ON public.course_enrollments(course_id, status);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_course 
  ON public.course_enrollments(user_id, course_id);

-- Course review queries
CREATE INDEX IF NOT EXISTS idx_course_reviews_course_rating 
  ON public.course_reviews(course_id, rating);

CREATE INDEX IF NOT EXISTS idx_course_reviews_user_course 
  ON public.course_reviews(user_id, course_id);

-- Lesson progress queries
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson 
  ON public.lesson_progress(user_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course 
  ON public.lesson_progress(user_id, course_id) 
  WHERE completed_at IS NOT NULL;

-- Credit transaction queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type_created 
  ON public.credit_transactions(user_id, transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference 
  ON public.credit_transactions(reference_type, reference_id);

-- Transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_created 
  ON public.transactions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_mode_status 
  ON public.transactions(transaction_mode, status);

-- Withdrawal queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_coach_status_created 
  ON public.withdrawal_requests(coach_id, status, created_at DESC);

-- Coach subscription queries
CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_coach_status 
  ON public.coach_subscriptions(coach_id, status);

CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_tier_status 
  ON public.coach_subscriptions(tier_id, status);

CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_renewal_date 
  ON public.coach_subscriptions(renewal_date) 
  WHERE status = 'active';

-- OAuth token queries
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider 
  ON public.oauth_tokens(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider_expires 
  ON public.oauth_tokens(provider, expires_at) 
  WHERE expires_at IS NOT NULL;

-- AI generation queries
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_action_created 
  ON public.ai_generations(user_id, action_key, created_at DESC);

-- Practice exercise queries
CREATE INDEX IF NOT EXISTS idx_practice_exercise_sets_lesson_status 
  ON public.practice_exercise_sets(lesson_id, status);

-- Content interaction queries
CREATE INDEX IF NOT EXISTS idx_content_interactions_user_content 
  ON public.content_interactions(user_id, content_id);

-- Course file queries
CREATE INDEX IF NOT EXISTS idx_course_files_course_lesson 
  ON public.course_files(course_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_course_files_module_lesson 
  ON public.course_files(module_id, lesson_id);

-- Invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_user_status 
  ON public.invoices(user_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription_status 
  ON public.invoices(subscription_id, status);

-- Security audit log queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_event 
  ON public.security_audit_log(user_id, event_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_target_event 
  ON public.security_audit_log(target_user_id, event_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_created 
  ON public.security_audit_log(created_at DESC);

-- Webhook processing log queries
CREATE INDEX IF NOT EXISTS idx_webhook_processing_log_status 
  ON public.webhook_processing_log(status);

CREATE INDEX IF NOT EXISTS idx_webhook_processing_log_created 
  ON public.webhook_processing_log(created_at DESC);

-- Login attempts queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_status_created 
  ON public.login_attempts(email, success, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_status_created 
  ON public.login_attempts(ip, success, created_at DESC);

-- User session versions queries
CREATE INDEX IF NOT EXISTS idx_user_session_versions_version 
  ON public.user_session_versions(version);

-- =====================================================================
-- PARTIAL INDEXES FOR COMMON QUERY PATTERNS
-- =====================================================================

-- Index for active enrollments only
CREATE INDEX IF NOT EXISTS idx_course_enrollments_active 
  ON public.course_enrollments(user_id, course_id) 
  WHERE status = 'active';

-- Index for pending withdrawals only
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_pending 
  ON public.withdrawal_requests(coach_id, created_at DESC) 
  WHERE status = 'pending';

-- Index for active subscriptions only
CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_active 
  ON public.coach_subscriptions(coach_id, renewal_date) 
  WHERE status = 'active';

-- Index for pending transactions only
CREATE INDEX IF NOT EXISTS idx_transactions_pending 
  ON public.transactions(user_id, created_at DESC) 
  WHERE status = 'pending';

-- Index for published courses only
CREATE INDEX IF NOT EXISTS idx_courses_published 
  ON public.courses(coach_id, updated_at DESC) 
  WHERE status = 'published';

-- Index for active credit packages
CREATE INDEX IF NOT EXISTS idx_credit_packages_active 
  ON public.credit_packages(price_mwk) 
  WHERE is_active = true;

-- =====================================================================
-- FOREIGN KEY INDEX OPTIMIZATION
-- =====================================================================

-- Add indexes for frequently joined foreign keys
CREATE INDEX IF NOT EXISTS idx_lessons_course 
  ON public.lessons(course_id) 
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_module 
  ON public.lessons(module_id) 
  WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_content_lesson 
  ON public.lesson_content(lesson_id) 
  WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_course_modules_course 
  ON public.course_modules(course_id) 
  WHERE course_id IS NOT NULL;

-- =====================================================================
-- END OF DATABASE CONSTRAINTS AND INDEXES
-- =====================================================================