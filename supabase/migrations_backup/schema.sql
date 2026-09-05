-- =====================================================================
-- EXPERT COACHING HUB - COMPLETE DATABASE SCHEMA
-- Generated from remote ECH project (vbrxgaxjmpwusbbbzzgl)
-- Date: 2026-03-29
-- =====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================================
-- ENUMS
-- =====================================================================

-- App Role Enum
CREATE TYPE app_role AS ENUM ('client', 'coach', 'admin');

-- Course Status Enum
CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');

-- Course Level Enum
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped');

-- Content Type Enum
CREATE TYPE content_type AS ENUM ('video', 'text', 'quiz', 'interactive', 'file', 'meeting');

-- Course Level Enum
CREATE TYPE course_level AS ENUM ('introduction', 'intermediate', 'advanced');

-- =====================================================================
-- TABLES
-- =====================================================================

-- User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK (role = ANY (ARRAY['client'::app_role, 'coach'::app_role, 'admin'::app_role]))
);

-- Courses
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    status course_status DEFAULT 'draft'::course_status,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    level course_level,
    tag TEXT,
    category TEXT,
    price_credits NUMERIC(10,2) DEFAULT 0.00 CHECK (price_credits >= 0::numeric),
    is_free BOOLEAN DEFAULT true,
    average_rating NUMERIC(3,2),
    review_count INTEGER DEFAULT 0
);

-- Course Modules
CREATE TABLE IF NOT EXISTS public.course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    estimated_duration INTEGER,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lesson Content
CREATE TABLE IF NOT EXISTS public.lesson_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    content_type content_type NOT NULL,
    content_data JSONB NOT NULL,
    order_index INTEGER,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    file_url TEXT,
    file_metadata JSONB
);

-- Course Enrollments
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    status enrollment_status DEFAULT 'active'::enrollment_status,
    progress_percentage INTEGER DEFAULT 0,
    enrolled_at TIMESTAMPTZ DEFAULT now(),
    credits_paid NUMERIC(10,2),
    credit_transaction_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Course Reviews
CREATE TABLE IF NOT EXISTS public.course_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Course Certificates
CREATE TABLE IF NOT EXISTS public.course_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    certificate_url TEXT,
    certificate_id TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ DEFAULT now(),
    template_version TEXT DEFAULT '1.0'::TEXT,
    verification_status TEXT DEFAULT 'valid'::TEXT CHECK (verification_status = ANY (ARRAY['valid'::TEXT, 'revoked'::TEXT, 'expired'::TEXT])),
    expires_at TIMESTAMPTZ
);

-- Course Files
CREATE TABLE IF NOT EXISTS public.course_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    tags TEXT[],
    description TEXT
);

-- OAuth Tokens (Secure Storage)
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    refresh_count INTEGER DEFAULT 0,
    last_refresh_request_id TEXT,
    refresh_token_rotated_at TIMESTAMPTZ,
    refresh_token_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit Wallets
CREATE TABLE IF NOT EXISTS public.credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit Transactions
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    balance_before NUMERIC(10,2) NOT NULL,
    balance_after NUMERIC(10,2) NOT NULL,
    transaction_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (Payment Records)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_ref TEXT NOT NULL UNIQUE,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT,
    status TEXT NOT NULL,
    gateway_response JSONB,
    order_id UUID,
    subscription_id UUID REFERENCES public.coach_subscriptions(id) ON DELETE CASCADE,
    transaction_mode TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    credits_amount NUMERIC(10,2),
    credit_package_id UUID
);

-- Coach Subscriptions
CREATE TABLE IF NOT EXISTS public.coach_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.tiers(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    renewal_date TIMESTAMPTZ,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    payment_method TEXT,
    billing_cycle TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    failed_renewal_attempts INTEGER DEFAULT 0,
    grace_expires_at TIMESTAMPTZ
);

-- Subscription Tiers
CREATE TABLE IF NOT EXISTS public.tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    features JSONB,
    price_monthly NUMERIC(10,2) NOT NULL,
    price_yearly NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credits_amount NUMERIC(10,2) NOT NULL,
    amount_mwk NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL,
    transaction_ref TEXT,
    payout_ref TEXT,
    payout_trans_id TEXT,
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Security Audit Log
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook Processing Log
CREATE TABLE IF NOT EXISTS public.webhook_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_ref TEXT NOT NULL UNIQUE,
    payload JSONB,
    status TEXT NOT NULL,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Generations
CREATE TABLE IF NOT EXISTS public.ai_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_key TEXT NOT NULL,
    actor_role TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    model TEXT,
    provider TEXT,
    response TEXT,
    response_format TEXT,
    tokens_prompt INTEGER,
    tokens_completion INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Practice Exercise Sets
CREATE TABLE IF NOT EXISTS public.practice_exercise_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    content_id UUID REFERENCES public.lesson_content(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    difficulty TEXT CHECK (difficulty = ANY (ARRAY['intro'::TEXT, 'intermediate'::TEXT, 'advanced'::TEXT])),
    skill_focus TEXT,
    target_audience TEXT,
    model_used TEXT,
    prompt_context JSONB,
    raw_output JSONB,
    status TEXT DEFAULT 'draft'::TEXT CHECK (status = ANY (ARRAY['draft'::TEXT, 'approved'::TEXT, 'rejected'::TEXT])),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ
);

-- Practice Exercise Items
CREATE TABLE IF NOT EXISTS public.practice_exercise_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES public.practice_exercise_sets(id) ON DELETE CASCADE,
    exercise_type TEXT NOT NULL CHECK (exercise_type = ANY (ARRAY['multiple_choice'::TEXT, 'short_answer'::TEXT, 'fill_in_blank'::TEXT, 'scenario'::TEXT, 'flashcard'::TEXT])),
    question TEXT NOT NULL,
    answer TEXT,
    explanation TEXT,
    choices JSONB,
    difficulty TEXT,
    tags TEXT[],
    order_index INTEGER DEFAULT 0,
    metadata JSONB,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Additional Tables (if they exist)
CREATE TABLE IF NOT EXISTS public.client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.lesson_content(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    source TEXT,
    is_ai_generated BOOLEAN,
    ai_summary TEXT,
    tags TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.lesson_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interaction_data JSONB,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_completion_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    progress_percentage INTEGER DEFAULT 0,
    content_completed INTEGER DEFAULT 0,
    content_total INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL,
    description TEXT,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_date TIMESTAMPTZ DEFAULT now(),
    payment_method TEXT,
    status TEXT NOT NULL,
    subscription_id UUID REFERENCES public.coach_subscriptions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coach_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    paychangu_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommended_courses (
    source_course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    recommended_course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    score NUMERIC(3,2) NOT NULL,
    PRIMARY KEY (source_course_id, recommended_course_id)
);

CREATE TABLE IF NOT EXISTS public.course_content_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    content_id UUID REFERENCES public.lesson_content(id) ON DELETE CASCADE,
    chunk TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    content_text TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- INDEXES
-- =====================================================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_course_id ON public.course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user_id ON public.course_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_ref ON public.transactions(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_coach_id ON public.coach_subscriptions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_status ON public.coach_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_coach_id ON public.withdrawal_requests(coach_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON public.ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_action_key ON public.ai_generations(action_key);
CREATE INDEX IF NOT EXISTS idx_lesson_content_lesson_id ON public.lesson_content(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON public.lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_practice_exercise_sets_lesson_id ON public.practice_exercise_sets(lesson_id);
CREATE INDEX IF NOT EXISTS idx_practice_exercise_sets_content_id ON public.practice_exercise_sets(content_id);
CREATE INDEX IF NOT EXISTS idx_practice_exercise_items_set_id ON public.practice_exercise_items(set_id);
CREATE INDEX IF NOT EXISTS idx_course_files_course_id ON public.course_files(course_id);
CREATE INDEX IF NOT EXISTS idx_course_files_lesson_id ON public.course_files(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_files_module_id ON public.course_files(module_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON public.oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON public.oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_last_refresh_request_id ON public.oauth_tokens(user_id, provider, last_refresh_request_id);

-- Vector indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_course_content_embeddings_embedding ON public.course_content_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_course_embeddings_embedding ON public.course_embeddings USING ivfflat (embedding vector_cosine_ops);

-- =====================================================================
-- RLS (Row Level Security) Policies
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_exercise_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completion_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommended_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_embeddings ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (these would need to be customized based on your auth system)
-- Example policies - adjust based on your actual requirements

-- Profiles: Users can see their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- User Roles: Users can see their own role
CREATE POLICY IF NOT EXISTS "Users can view own role" ON public.user_roles
    FOR ALL USING (auth.uid() = user_id);

-- Courses: Published courses are visible to all authenticated users
CREATE POLICY IF NOT EXISTS "Published courses are viewable" ON public.courses
    FOR SELECT USING (status = 'published');

-- Course enrollments: Users can see their own enrollments
CREATE POLICY IF NOT EXISTS "Users can view own enrollments" ON public.course_enrollments
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Trigger to update course ratings when reviews are added/updated
CREATE OR REPLACE FUNCTION public.update_course_rating()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.update_course_rating(NEW.course_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_course_rating
    AFTER INSERT OR UPDATE ON public.course_reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_course_rating();

-- Trigger to issue certificates when course is completed
CREATE OR REPLACE FUNCTION public.trigger_issue_certificate()
RETURNS TRIGGER AS $$
BEGIN
    -- Only issue certificate if progress reaches 100% and status is completed
    IF NEW.progress_percentage >= 100 AND NEW.status = 'completed' THEN
        PERFORM public.issue_course_certificate(NEW.user_id, NEW.course_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_issue_certificate
    AFTER UPDATE ON public.course_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.trigger_issue_certificate();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER IF NOT EXISTS trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_course_modules_updated_at
    BEFORE UPDATE ON public.course_modules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_lessons_updated_at
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_lesson_content_updated_at
    BEFORE UPDATE ON public.lesson_content
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_course_enrollments_updated_at
    BEFORE UPDATE ON public.course_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_course_reviews_updated_at
    BEFORE UPDATE ON public.course_reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_course_certificates_updated_at
    BEFORE UPDATE ON public.course_certificates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_course_files_updated_at
    BEFORE UPDATE ON public.course_files
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_oauth_tokens_updated_at
    BEFORE UPDATE ON public.oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_credit_wallets_updated_at
    BEFORE UPDATE ON public.credit_wallets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_credit_transactions_updated_at
    BEFORE UPDATE ON public.credit_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_coach_subscriptions_updated_at
    BEFORE UPDATE ON public.coach_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_tiers_updated_at
    BEFORE UPDATE ON public.tiers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_withdrawal_requests_updated_at
    BEFORE UPDATE ON public.withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_security_audit_log_updated_at
    BEFORE UPDATE ON public.security_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_webhook_processing_log_updated_at
    BEFORE UPDATE ON public.webhook_processing_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_ai_generations_updated_at
    BEFORE UPDATE ON public.ai_generations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_practice_exercise_sets_updated_at
    BEFORE UPDATE ON public.practice_exercise_sets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_practice_exercise_items_updated_at
    BEFORE UPDATE ON public.practice_exercise_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RPC FUNCTIONS
-- =====================================================================

-- Admin Process Withdrawal
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
    p_withdrawal_id UUID,
    p_action BOOLEAN,
    p_admin_id UUID DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    wr RECORD;
    process_result JSON;
    resulting_status TEXT;
BEGIN
    IF p_action NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Action must be approve or reject';
    END IF;
    
    SELECT id, coach_id, credits_amount, amount_mwk, status
    INTO wr
    FROM withdrawal_requests
    WHERE id = p_withdrawal_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;
    
    IF wr.status <> 'pending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'withdrawal_id', p_withdrawal_id,
            'status', wr.status,
            'message', format('Withdrawal already processed with status %s', wr.status)
        );
    END IF;
    
    IF p_action = 'approve' THEN
        process_result := public.process_withdrawal(
            wr.coach_id,
            wr.credits_amount,
            wr.amount_mwk,
            p_withdrawal_id,
            NULL,
            NULL,
            'mobile_money'
        );
        UPDATE withdrawal_requests
        SET processed_by = p_admin_id,
            admin_notes = COALESCE(p_admin_notes, admin_notes)
        WHERE id = p_withdrawal_id;
        resulting_status := 'completed';
    ELSE
        UPDATE withdrawal_requests
        SET status = 'failed',
            processed_at = now(),
            processed_by = p_admin_id,
            admin_notes = COALESCE(p_admin_notes, admin_notes),
            rejection_reason = COALESCE(p_admin_notes, rejection_reason, 'Rejected by admin')
        WHERE id = p_withdrawal_id;
        resulting_status := 'failed';
    END IF;
    
    INSERT INTO security_audit_log (
        event_type,
        user_id,
        target_user_id,
        details
    ) VALUES (
        'withdrawal_processed',
        p_admin_id,
        wr.coach_id,
        jsonb_build_object(
            'withdrawal_id', p_withdrawal_id,
            'action', p_action,
            'status', resulting_status
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'withdrawal_id', p_withdrawal_id,
        'status', resulting_status,
        'message', format('Withdrawal %s successfully', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END)
    );
END;
$$;

-- Calculate Renewal Date
CREATE OR REPLACE FUNCTION public.calculate_renewal_date(
    _billing_cycle TEXT,
    _start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF _billing_cycle = 'yearly' THEN
        RETURN _start_date + INTERVAL '1 year';
    ELSIF _billing_cycle = 'monthly' THEN
        RETURN _start_date + INTERVAL '1 month';
    ELSE
        RETURN _start_date;
    END IF;
END;
$$;

-- Check Duplicate Subscription
CREATE OR REPLACE FUNCTION public.check_duplicate_subscription(
    _coach_id UUID,
    _package_id UUID DEFAULT NULL,
    _tier_id UUID DEFAULT NULL,
    _user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    -- Check for active coach subscriptions
    IF _tier_id IS NOT NULL THEN
        SELECT COUNT(*) INTO existing_count
        FROM public.coach_subscriptions
        WHERE coach_id = _coach_id
            AND tier_id = _tier_id
            AND status = 'active';
        IF existing_count > 0 THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Check for active client subscriptions
    IF _package_id IS NOT NULL THEN
        SELECT COUNT(*) INTO existing_count
        FROM public.client_subscriptions
        WHERE client_id = _user_id
            AND coach_id = _coach_id
            AND package_id = _package_id
            AND status = 'active';
        IF existing_count > 0 THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Cleanup Expired Recommendations
CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendations()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.recommended_courses
    WHERE expires_at < now();
END;
$$;

-- Cleanup Orphaned Files
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_files()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete files from storage that don't have corresponding database records
    -- This would typically be called by a scheduled job
    NULL;
END;
$$;

-- Commit Transaction (placeholder)
CREATE OR REPLACE FUNCTION public.commit_transaction()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- In a real implementation, this would commit a database transaction
    -- For now, we'll just return a success indicator
    RETURN 'transaction_committed';
END;
$$;

-- Enroll with Credits Atomic
CREATE OR REPLACE FUNCTION public.enroll_with_credits_atomic(
    p_user_id UUID,
    p_course_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_course public.courses%ROWTYPE;
    v_buyer_wallet public.credit_wallets%ROWTYPE;
    v_coach_wallet public.credit_wallets%ROWTYPE;
    v_enrollment_id UUID;
    v_sender_transaction_id UUID;
    v_receiver_transaction_id UUID;
    v_price NUMERIC(10,2);
BEGIN
    PERFORM set_config('transaction_isolation', 'serializable', true);
    
    SELECT *
    INTO v_course
    FROM public.courses
    WHERE id = p_course_id
    FOR UPDATE;
    
    IF NOT FOUND OR v_course.status <> 'published' THEN
        RAISE EXCEPTION 'Course not purchasable';
    END IF;
    
    IF v_course.coach_id IS NULL THEN
        RAISE EXCEPTION 'Course owner not found';
    END IF;
    
    IF v_course.coach_id = p_user_id THEN
        RAISE EXCEPTION 'Cannot enroll in your own course';
    END IF;
    
    v_price := COALESCE(v_course.price_credits, 0);
    
    BEGIN
        INSERT INTO public.course_enrollments (
            user_id,
            course_id,
            credits_paid,
            payment_status
        ) VALUES (
            p_user_id,
            p_course_id,
            CASE WHEN COALESCE(v_course.is_free, false) OR v_price <= 0 THEN 0 ELSE v_price END,
            CASE WHEN COALESCE(v_course.is_free, false) OR v_price <= 0 THEN 'free' ELSE 'paid' END
        )
        RETURNING id INTO v_enrollment_id;
        
        IF NOT COALESCE(v_course.is_free, false) OR v_price > 0 THEN
            -- Transfer credits from buyer to coach
            INSERT INTO public.credit_transactions (
                user_id,
                amount,
                balance_before,
                balance_after,
                transaction_type,
                reference_type,
                reference_id,
                description,
                metadata
            ) VALUES (
                p_user_id, -- buyer
                v_price,
                v_buyer_wallet.balance,
                v_buyer_wallet.balance - v_price,
                'course_payment',
                'course_enrollment',
                v_enrollment_id,
                format('Enrolled in course: %s', v_course.title)
            )
            RETURNING id INTO v_sender_transaction_id;
            
            INSERT INTO public.credit_transactions (
                user_id,
                amount,
                balance_before,
                balance_after,
                transaction_type,
                reference_type,
                reference_id,
                description,
                metadata
            ) VALUES (
                v_course.coach_id, -- coach
                v_price,
                v_coach_wallet.balance,
                v_coach_wallet.balance + v_price,
                'course_earning',
                'course_enrollment',
                v_enrollment_id,
                format('Payment for course enrollment: %s', v_course.title)
            )
            RETURNING id INTO v_receiver_transaction_id;
            
            RETURN jsonb_build_object(
                'success', true,
                'enrollment_id', v_enrollment_id,
                'payment_status', CASE WHEN COALESCE(v_course.is_free, false) OR v_price <= 0 THEN 'free' ELSE 'paid' END,
                'credits_paid', v_price,
                'transaction_id', v_sender_transaction_id,
                'receiver_transaction_id', v_receiver_transaction_id
            );
        ELSE
            RETURN jsonb_build_object(
                'success', true,
                'enrollment_id', v_enrollment_id,
                'payment_status', 'free',
                'credits_paid', 0,
                'transaction_id', NULL,
                'receiver_transaction_id', NULL
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback the enrollment on any error
            DELETE FROM public.course_enrollments WHERE id = v_enrollment_id;
            RAISE;
    END;
END;
$$;

-- Generate Certificate ID
CREATE OR REPLACE FUNCTION public.generate_certificate_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 8);
END;
$$;

-- Generate Invoice Number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((random() * 10000)::integer::text, 4, '0');
END;
$$;

-- Get Aged Credits
CREATE OR REPLACE FUNCTION public.get_aged_credits(
    p_min_age_days INTEGER DEFAULT 30,
    p_user_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    aged_credits NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO aged_credits
    FROM public.credit_transactions
    WHERE user_id = p_user_id
        AND created_at < now() - INTERVAL '1 day' * p_min_age_days
        AND transaction_type IN ('course_earning', 'refund', 'bonus');
    
    RETURN aged_credits;
END;
$$;

-- Get Available Withdrawable Credits
CREATE OR REPLACE FUNCTION public.get_available_withdrawable_credits(
    credit_aging_days_param INTEGER,
    user_id_param UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    available_credits NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO available_credits
    FROM public.credit_transactions
    WHERE user_id = user_id_param
        AND created_at < now() - INTERVAL '1 day' * credit_aging_days_param
        AND transaction_type IN ('course_earning', 'refund', 'bonus')
        AND created_at >= (
            SELECT COALESCE(MAX(created_at), now() - INTERVAL '90 days')
            FROM public.withdrawal_requests
            WHERE coach_id = user_id_param
                AND status = 'completed'
        );
    
    RETURN available_credits;
END;
$$;

-- Get Coach Paychangu Secret
CREATE OR REPLACE FUNCTION public.get_coach_paychangu_secret(
    _coach_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT paychangu_secret
        FROM public.coach_settings
        WHERE coach_id = _coach_id
    ), '');
END;
$$;

-- Get Coach Payment Key
CREATE OR REPLACE FUNCTION public.get_coach_payment_key(
    coach_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT payment_key
        FROM public.coach_settings
        WHERE coach_id = coach_user_id
    ), '');
END;
$$;

-- Get File Signed URL Placeholder
CREATE OR REPLACE FUNCTION public.get_file_signed_url_placeholder(
    file_path TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- This would generate a signed URL for file access
    -- Implementation depends on your storage provider (S3, GCS, etc.)
    RETURN 'https://signed-url-example.com/' || file_path;
END;
$$;

-- Get Next Lesson
CREATE OR REPLACE FUNCTION public.get_next_lesson(
    _course_id UUID,
    _user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_lesson_id UUID;
BEGIN
    SELECT l.id INTO next_lesson_id
    FROM public.lessons l
    JOIN public.course_modules cm ON cm.id = l.module_id
    WHERE cm.course_id = _course_id
        AND l.order_index > COALESCE((
            SELECT MAX(l2.order_index)
            FROM public.lesson_progress lp
            JOIN public.lessons l2 ON l2.id = lp.lesson_id
            WHERE lp.user_id = _user_id
                AND lp.completed_at IS NOT NULL
        ), 0)
    ORDER BY l.order_index
    LIMIT 1;
    
    RETURN next_lesson_id;
END;
$$;

-- Has Role
CREATE OR REPLACE FUNCTION public.has_role(
    _role app_role,
    _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = _role
    ) INTO user_role_exists;
    
    RETURN user_role_exists;
END;
$$;

-- Increment File Download
CREATE OR REPLACE FUNCTION public.increment_file_download(
    file_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.course_files
    SET download_count = download_count + 1
    WHERE id = file_id;
END;
$$;

-- Is Subscription Expiring Soon
CREATE OR REPLACE FUNCTION public.is_subscription_expiring_soon(
    _days_ahead INTEGER DEFAULT 7,
    _subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_expires TIMESTAMPTZ;
BEGIN
    SELECT renewal_date INTO subscription_expires
    FROM public.coach_subscriptions
    WHERE id = _subscription_id;
    
    RETURN subscription_expires <= (now() + INTERVAL '1 day' * _days_ahead);
END;
$$;

-- Issue Course Certificate
CREATE OR REPLACE FUNCTION public.issue_course_certificate(
    p_course_id UUID,
    p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    certificate_id TEXT;
BEGIN
    certificate_id := public.generate_certificate_id();
    
    INSERT INTO public.course_certificates (
        course_id,
        user_id,
        certificate_id
    ) VALUES (
        p_course_id,
        p_user_id,
        certificate_id
    );
    
    RETURN certificate_id;
END;
$$;

-- Mark Lesson Complete
CREATE OR REPLACE FUNCTION public.mark_lesson_complete(
    _lesson_id UUID,
    _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    completion_recorded BOOLEAN;
BEGIN
    UPDATE public.lesson_progress
    SET is_completed = true,
        completed_at = now(),
        progress_percentage = 100
    WHERE lesson_id = _lesson_id AND user_id = _user_id
    RETURNING * INTO completion_recorded;
    
    RETURN completion_recorded IS NOT NULL;
END;
$$;

-- Mark Old Processing Withdrawals as Pending
CREATE OR REPLACE FUNCTION public.mark_old_processing_withdrawals_as_pending()
RETURNS TABLE (
    hours_processing NUMERIC,
    new_status TEXT,
    old_status TEXT,
    withdrawal_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.withdrawal_requests
    SET status = 'pending'
    WHERE status = 'processing'
        AND created_at < now() - INTERVAL '2 hours'
    RETURNING 
        EXTRACT(EPOCH FROM (now() - created_at))/3600 as hours_processing,
        'pending' as new_status,
        status as old_status,
        id as withdrawal_id;
END;
$$;

-- Process Withdrawal
CREATE OR REPLACE FUNCTION public.process_withdrawal(
    amount_mwk NUMERIC,
    coach_id UUID,
    credits_amount NUMERIC,
    payment_method TEXT DEFAULT NULL,
    payout_ref TEXT DEFAULT NULL,
    payout_trans_id TEXT DEFAULT NULL,
    withdrawal_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    process_result JSON;
BEGIN
    -- This would integrate with payment provider (mobile money, bank transfer, etc.)
    -- For now, return a mock response
    process_result := jsonb_build_object(
        'success', true,
        'withdrawal_id', withdrawal_id,
        'amount_mwk', amount_mwk,
        'credits_amount', credits_amount,
        'payment_method', payment_method,
        'payout_ref', payout_ref,
        'payout_trans_id', payout_trans_id,
        'processed_at', now()
    );
    
    RETURN process_result;
END;
$$;

-- Refund Failed Withdrawal
CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(
    coach_id UUID,
    credits_amount NUMERIC,
    withdrawal_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    refund_result JSON;
BEGIN
    -- Refund credits to coach wallet
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        reference_type,
        reference_id,
        description,
        metadata
    ) SELECT 
        coach_id,
        credits_amount,
        balance,
        balance + credits_amount,
        'refund',
        'withdrawal_request',
        withdrawal_id,
        'Refund for failed withdrawal',
        jsonb_build_object(
            'withdrawal_id', withdrawal_id,
            'failure_reason', 'Payout failed - credits refunded'
        )
    FROM public.credit_wallets
    WHERE user_id = coach_id;
    
    refund_result := jsonb_build_object(
        'success', true,
        'withdrawal_id', withdrawal_id,
        'credits_refunded', credits_amount
    );
    
    RETURN refund_result;
END;
$$;

-- Rollback Transaction (placeholder)
CREATE OR REPLACE FUNCTION public.rollback_transaction()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- In a real implementation, this would rollback a database transaction
    -- For now, we'll just return a success indicator
    RETURN 'transaction_rolled_back';
END;
$$;

-- Transfer Credits
CREATE OR REPLACE FUNCTION public.transfer_credits(
    from_user_id UUID,
    to_user_id UUID,
    amount NUMERIC,
    transaction_type TEXT,
    reference_type TEXT DEFAULT NULL,
    reference_id UUID DEFAULT NULL,
    description TEXT DEFAULT NULL,
    metadata JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    from_wallet public.credit_wallets%ROWTYPE;
    to_wallet public.credit_wallets%ROWTYPE;
    sender_transaction_id UUID;
    receiver_transaction_id UUID;
BEGIN
    PERFORM set_config('transaction_isolation', 'serializable', true);
    
    -- Get wallets and lock them
    SELECT * INTO from_wallet FROM public.credit_wallets WHERE user_id = from_user_id FOR UPDATE;
    SELECT * INTO to_wallet FROM public.credit_wallets WHERE user_id = to_user_id FOR UPDATE;
    
    -- Check sender has sufficient balance
    IF from_wallet.balance < amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Create sender transaction record
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        reference_type,
        reference_id,
        description,
        metadata
    ) VALUES (
        from_user_id,
        amount,
        from_wallet.balance,
        from_wallet.balance - amount,
        transaction_type,
        reference_type,
        reference_id,
        description,
        metadata
    )
    RETURNING id INTO sender_transaction_id;
    
    -- Create receiver transaction record
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        reference_type,
        reference_id,
        description,
        metadata
    ) VALUES (
        to_user_id,
        amount,
        to_wallet.balance,
        to_wallet.balance + amount,
        transaction_type,
        reference_type,
        reference_id,
        description,
        metadata
    )
    RETURNING id INTO receiver_transaction_id;
    
    -- Update wallet balances
    UPDATE public.credit_wallets SET balance = from_wallet.balance - amount WHERE user_id = from_user_id;
    UPDATE public.credit_wallets SET balance = to_wallet.balance + amount WHERE user_id = to_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'sender_transaction_id', sender_transaction_id,
        'receiver_transaction_id', receiver_transaction_id,
        'amount', amount,
        'from_user_id', from_user_id,
        'to_user_id', to_user_id
    );
END;
$$;

-- Update Course Rating
CREATE OR REPLACE FUNCTION public.update_course_rating(
    course_uuid UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_rating NUMERIC;
    review_cnt INTEGER;
BEGIN
    SELECT 
        COALESCE(AVG(rating), 0)::NUMERIC(3,2),
        COUNT(*)
    INTO avg_rating, review_cnt
    FROM course_reviews 
    WHERE course_id = course_uuid;
    
    UPDATE courses 
    SET 
        average_rating = avg_rating,
        review_count = review_cnt,
        updated_at = now()
    WHERE id = course_uuid;
END;
$$;

-- Upsert Own Role
CREATE OR REPLACE FUNCTION public.upsert_own_role(
    p_role app_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_existing public.user_roles%ROWTYPE;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: no auth.uid()';
    END IF;
    
    IF p_role IS NULL THEN
        RAISE EXCEPTION 'Role must not be null';
    END IF;
    
    -- SECURITY: Prevent self-assignment of admin role
    IF p_role = 'admin' THEN
        RAISE EXCEPTION 'Cannot self-assign admin role';
    END IF;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, p_role)
    ON CONFLICT (user_id) 
    DO UPDATE SET role = EXCLUDED.role
    RETURNING * INTO v_existing;
    
    PERFORM auth.set_claim(
        v_user_id,
        'user_metadata',
        jsonb_set(
            COALESCE((select raw_user_meta_data from auth.users where id = v_user_id), '{}'::jsonb),
            '{role}',
            to_jsonb(p_role::text),
            true
        )
    );
    
    v_result := jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'role', v_existing.role
    );
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Validate Subscription Status Transition
CREATE OR REPLACE FUNCTION public.validate_subscription_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Validate Transaction Status Transition
CREATE OR REPLACE FUNCTION public.validate_transaction_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only allow specific status transitions
    IF OLD.status = 'pending' AND NEW.status NOT IN ('success', 'failed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
    END IF;
    
    IF OLD.status = 'success' AND NEW.status != 'success' THEN
        RAISE EXCEPTION 'Cannot change status from success to %', NEW.status;
    END IF;
    
    IF OLD.status = 'failed' AND NEW.status NOT IN ('pending', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from failed to %', NEW.status;
    END IF;
    
    IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
        RAISE EXCEPTION 'Cannot change status from cancelled to %', NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Verify Certificate
CREATE OR REPLACE FUNCTION public.verify_certificate(
    p_certificate_id TEXT
)
RETURNS RECORD (
    certificate_id TEXT,
    coach_name TEXT,
    course_title TEXT,
    expires_at TIMESTAMPTZ,
    is_valid BOOLEAN,
    issued_at TIMESTAMPTZ,
    student_name TEXT,
    verification_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cv.certificate_id,
        c.title as course_title,
        p.full_name as coach_name,
        cv.issued_at,
        cv.expires_at,
        (cv.verification_status = 'valid' AND 
         (cv.expires_at IS NULL OR cv.expires_at > now()))::BOOLEAN as is_valid,
        u.full_name as student_name,
        cv.verification_status
    FROM certificate_verification cv
    JOIN public.course_certificates cc ON cc.certificate_id = cv.certificate_id
    JOIN public.courses c ON c.id = cc.course_id
    JOIN auth.users u ON u.id = cc.user_id
    JOIN public.profiles p ON p.id = u.id
    WHERE cv.certificate_id = p_certificate_id;
END;
$$;

-- Calculate Course Progress
CREATE OR REPLACE FUNCTION public.calculate_course_progress(
    _user_id UUID,
    _course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_lessons INTEGER;
    completed_lessons INTEGER;
    progress INTEGER;
BEGIN
    -- Count total lessons in the course
    SELECT COUNT(*) INTO total_lessons
    FROM public.lessons l
    JOIN public.course_modules cm ON cm.id = l.module_id
    WHERE cm.course_id = _course_id;
    
    -- Count completed lessons
    SELECT COUNT(*) INTO completed_lessons
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    JOIN public.course_modules cm ON cm.id = l.module_id
    WHERE cm.course_id = _course_id
        AND lp.user_id = _user_id
        AND lp.is_completed = true;
    
    -- Calculate progress percentage
    IF total_lessons = 0 THEN
        progress := 0;
    ELSE
        progress := ROUND((completed_lessons::DECIMAL / total_lessons::DECIMAL) * 100);
    END IF;
    
    -- Update enrollment progress
    UPDATE public.course_enrollments
    SET progress_percentage = progress,
        status = CASE 
            WHEN progress = 100 THEN 'completed'::enrollment_status
            ELSE status
        END,
        completed_at = CASE 
            WHEN progress = 100 AND completed_at IS NULL THEN now()
            ELSE completed_at
        END
    WHERE user_id = _user_id AND course_id = _course_id;
    
    RETURN progress;
END;
$$;

COMMIT;
