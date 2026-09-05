-- =====================================================================
-- COMPREHENSIVE RLS POLICIES
-- Date: 2026-08-28
-- Purpose: Implement comprehensive Row Level Security policies for all tables
-- Security: Replaces incomplete example policies with production-ready security
-- =====================================================================

-- Helper function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = p_role
  );
$$;

-- Helper function to check if user is coach of a course
CREATE OR REPLACE FUNCTION public.is_course_coach(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses 
    WHERE id = p_course_id AND coach_id = auth.uid()
  );
$$;

-- Helper function to check if user is coach of a lesson (via module → course)
CREATE OR REPLACE FUNCTION public.is_lesson_coach(p_lesson_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.course_modules cm ON cm.id = l.module_id
    JOIN public.courses c ON c.id = cm.course_id
    WHERE l.id = p_lesson_id AND c.coach_id = auth.uid()
  );
$$;

-- Helper function to check if user is enrolled in a course
CREATE OR REPLACE FUNCTION public.is_enrolled(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments 
    WHERE course_id = p_course_id AND user_id = auth.uid()
  );
$$;

-- =====================================================================
-- PROFILES RLS POLICIES
-- =====================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Users can view all profiles (for coach discovery)
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (onboarding)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================================
-- USER ROLES RLS POLICIES
-- =====================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

-- Users can view their own role
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Users cannot directly modify roles (use upsert-user-role function)
CREATE POLICY "No direct role modifications" ON public.user_roles
  FOR ALL USING (false);

-- =====================================================================
-- COURSES RLS POLICIES
-- =====================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Published courses are viewable" ON public.courses;

-- Everyone can view published courses
CREATE POLICY "Published courses are viewable" ON public.courses
  FOR SELECT USING (status = 'published');

-- Course coaches can view their own courses (including draft/archived)
CREATE POLICY "Coaches can view own courses" ON public.courses
  FOR SELECT USING (coach_id = auth.uid());

-- Admins can view all courses
CREATE POLICY "Admins can view all courses" ON public.courses
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Coaches can insert their own courses
CREATE POLICY "Coaches can insert own courses" ON public.courses
  FOR INSERT WITH CHECK (coach_id = auth.uid());

-- Coaches can update their own courses
CREATE POLICY "Coaches can update own courses" ON public.courses
  FOR UPDATE USING (coach_id = auth.uid());

-- Admins can update any course
CREATE POLICY "Admins can update any course" ON public.courses
  FOR UPDATE USING (public.has_role('admin'::app_role));

-- Coaches can delete their own courses
CREATE POLICY "Coaches can delete own courses" ON public.courses
  FOR DELETE USING (coach_id = auth.uid());

-- Admins can delete any course
CREATE POLICY "Admins can delete any course" ON public.courses
  FOR DELETE USING (public.has_role('admin'::app_role));

-- =====================================================================
-- COURSE MODULES RLS POLICIES
-- =====================================================================

-- Everyone can view modules of published courses
CREATE POLICY "View modules of published courses" ON public.course_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_modules.course_id AND courses.status = 'published'
    )
  );

-- Course coaches can view their own course modules
CREATE POLICY "Coaches can view own course modules" ON public.course_modules
  FOR SELECT USING (public.is_course_coach(course_id));

-- Admins can view all modules
CREATE POLICY "Admins can view all modules" ON public.course_modules
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Enrolled users can view modules of enrolled courses
CREATE POLICY "Enrolled users can view course modules" ON public.course_modules
  FOR SELECT USING (public.is_enrolled(course_id));

-- Coaches can manage their own course modules
CREATE POLICY "Coaches can manage own course modules" ON public.course_modules
  FOR ALL USING (public.is_course_coach(course_id));

-- Admins can manage all modules
CREATE POLICY "Admins can manage all modules" ON public.course_modules
  FOR ALL USING (public.has_role('admin'::app_role));

-- =====================================================================
-- LESSONS RLS POLICIES
-- =====================================================================

-- Everyone can view lessons of published courses
CREATE POLICY "View lessons of published courses" ON public.lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.course_modules cm ON cm.id = l.module_id
      JOIN public.courses c ON c.id = cm.course_id
      WHERE l.id = lessons.id AND c.status = 'published'
    )
  );

-- Course coaches can view their own lessons
CREATE POLICY "Coaches can view own lessons" ON public.lessons
  FOR SELECT USING (public.is_lesson_coach(id));

-- Admins can view all lessons
CREATE POLICY "Admins can view all lessons" ON public.lessons
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Enrolled users can view lessons of enrolled courses
CREATE POLICY "Enrolled users can view lessons" ON public.lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.course_modules cm ON cm.id = l.module_id
      WHERE l.id = lessons.id AND public.is_enrolled(cm.course_id)
    )
  );

-- Coaches can manage their own lessons
CREATE POLICY "Coaches can manage own lessons" ON public.lessons
  FOR ALL USING (public.is_lesson_coach(id));

-- Admins can manage all lessons
CREATE POLICY "Admins can manage all lessons" ON public.lessons
  FOR ALL USING (public.has_role('admin'::app_role));

-- =====================================================================
-- LESSON CONTENT RLS POLICIES
-- =====================================================================

-- Everyone can view content of published courses
CREATE POLICY "View content of published courses" ON public.lesson_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.course_modules cm ON cm.id = l.module_id
      JOIN public.courses c ON c.id = cm.course_id
      WHERE l.id = lesson_content.lesson_id AND c.status = 'published'
    )
  );

-- Course coaches can view their own content
CREATE POLICY "Coaches can view own content" ON public.lesson_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_content.lesson_id AND public.is_lesson_coach(l.id)
    )
  );

-- Admins can view all content
CREATE POLICY "Admins can view all content" ON public.lesson_content
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Enrolled users can view content of enrolled courses
CREATE POLICY "Enrolled users can view content" ON public.lesson_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.course_modules cm ON cm.id = l.module_id
      WHERE l.id = lesson_content.lesson_id AND public.is_enrolled(cm.course_id)
    )
  );

-- Coaches can manage their own content
CREATE POLICY "Coaches can manage own content" ON public.lesson_content
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_content.lesson_id AND public.is_lesson_coach(l.id)
    )
  );

-- Admins can manage all content
CREATE POLICY "Admins can manage all content" ON public.lesson_content
  FOR ALL USING (public.has_role('admin'::app_role));

-- =====================================================================
-- COURSE ENROLLMENTS RLS POLICIES
-- =====================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.course_enrollments;

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments" ON public.course_enrollments
  FOR SELECT USING (user_id = auth.uid());

-- Coaches can view enrollments in their courses
CREATE POLICY "Coaches can view course enrollments" ON public.course_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_enrollments.course_id AND courses.coach_id = auth.uid()
    )
  );

-- Admins can view all enrollments
CREATE POLICY "Admins can view all enrollments" ON public.course_enrollments
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Users can insert their own enrollments
CREATE POLICY "Users can insert own enrollments" ON public.course_enrollments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own enrollments (progress)
CREATE POLICY "Users can update own enrollments" ON public.course_enrollments
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own enrollments
CREATE POLICY "Users can delete own enrollments" ON public.course_enrollments
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================================
-- COURSE REVIEWS RLS POLICIES
-- =====================================================================

-- Everyone can view reviews of published courses
CREATE POLICY "View reviews of published courses" ON public.course_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_reviews.course_id AND courses.status = 'published'
    )
  );

-- Users can view their own reviews
CREATE POLICY "Users can view own reviews" ON public.course_reviews
  FOR SELECT USING (user_id = auth.uid());

-- Coaches can view reviews of their courses
CREATE POLICY "Coaches can view course reviews" ON public.course_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_reviews.course_id AND courses.coach_id = auth.uid()
    )
  );

-- Admins can view all reviews
CREATE POLICY "Admins can view all reviews" ON public.course_reviews
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews" ON public.course_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON public.course_reviews
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews" ON public.course_reviews
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================================
-- COURSE CERTIFICATES RLS POLICIES
-- =====================================================================

-- Users can view their own certificates
CREATE POLICY "Users can view own certificates" ON public.course_certificates
  FOR SELECT USING (user_id = auth.uid());

-- Coaches can view certificates for their courses
CREATE POLICY "Coaches can view course certificates" ON public.course_certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_certificates.course_id AND courses.coach_id = auth.uid()
    )
  );

-- Admins can view all certificates
CREATE POLICY "Admins can view all certificates" ON public.course_certificates
  FOR SELECT USING (public.has_role('admin'::app_role));

-- System can insert certificates (via function)
CREATE POLICY "System can insert certificates" ON public.course_certificates
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- COURSE FILES RLS POLICIES
-- =====================================================================

-- Everyone can view public files
CREATE POLICY "View public files" ON public.course_files
  FOR SELECT USING (is_public = true);

-- Users can view files of courses they're enrolled in
CREATE POLICY "Users can view enrolled course files" ON public.course_files
  FOR SELECT USING (
    course_id IS NOT NULL AND public.is_enrolled(course_id)
  );

-- Coaches can view their own course files
CREATE POLICY "Coaches can view own course files" ON public.course_files
  FOR SELECT USING (
    course_id IS NOT NULL AND public.is_course_coach(course_id)
  );

-- Admins can view all files
CREATE POLICY "Admins can view all files" ON public.course_files
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Coaches can manage their own course files
CREATE POLICY "Coaches can manage own course files" ON public.course_files
  FOR ALL USING (
    uploaded_by = auth.uid() OR 
    (course_id IS NOT NULL AND public.is_course_coach(course_id))
  );

-- Admins can manage all files
CREATE POLICY "Admins can manage all files" ON public.course_files
  FOR ALL USING (public.has_role('admin'::app_role));

-- =====================================================================
-- OAUTH TOKENS RLS POLICIES
-- =====================================================================

-- Lock oauth_tokens to service-role only
CREATE POLICY "Lock oauth_tokens" ON public.oauth_tokens FOR ALL USING (false);

-- =====================================================================
-- CREDIT WALLETS RLS POLICIES
-- =====================================================================

-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON public.credit_wallets
  FOR SELECT USING (user_id = auth.uid());

-- Users cannot directly modify wallets (use functions)
CREATE POLICY "No direct wallet modifications" ON public.credit_wallets
  FOR ALL USING (false);

-- =====================================================================
-- CREDIT TRANSACTIONS RLS POLICIES
-- =====================================================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid());

-- =====================================================================
-- COACH SUBSCRIPTIONS RLS POLICIES
-- =====================================================================

-- Coaches can view their own subscriptions
CREATE POLICY "Coaches can view own subscriptions" ON public.coach_subscriptions
  FOR SELECT USING (coach_id = auth.uid());

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.coach_subscriptions
  FOR SELECT USING (public.has_role('admin'::app_role));

-- System can insert subscriptions (via functions)
CREATE POLICY "System can insert subscriptions" ON public.coach_subscriptions
  FOR INSERT WITH CHECK (true);

-- System can update subscriptions (via functions)
CREATE POLICY "System can update subscriptions" ON public.coach_subscriptions
  FOR UPDATE USING (true);

-- =====================================================================
-- TIERS RLS POLICIES
-- =====================================================================

-- Everyone can view tiers (public pricing)
CREATE POLICY "Everyone can view tiers" ON public.tiers
  FOR SELECT USING (true);

-- Admins can manage tiers
CREATE POLICY "Admins can manage tiers" ON public.tiers
  FOR ALL USING (public.has_role('admin'::app_role));

-- =====================================================================
-- WITHDRAWAL REQUESTS RLS POLICIES
-- =====================================================================

-- Coaches can view their own withdrawal requests
CREATE POLICY "Coaches can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (coach_id = auth.uid());

-- Admins can view all withdrawal requests
CREATE POLICY "Admins can view all withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Coaches can insert their own withdrawal requests
CREATE POLICY "Coaches can insert own withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (coach_id = auth.uid());

-- Admins can update withdrawal requests (approval)
CREATE POLICY "Admins can update withdrawals" ON public.withdrawal_requests
  FOR UPDATE USING (public.has_role('admin'::app_role));

-- =====================================================================
-- SECURITY AUDIT LOG RLS POLICIES
-- =====================================================================

-- Admins can view security audit log
CREATE POLICY "Admins can view security log" ON public.security_audit_log
  FOR SELECT USING (public.has_role('admin'::app_role));

-- System can insert audit entries (via functions)
CREATE POLICY "System can insert security log" ON public.security_audit_log
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- WEBHOOK PROCESSING LOG RLS POLICIES
-- =====================================================================

-- Admins can view webhook processing log
CREATE POLICY "Admins can view webhook log" ON public.webhook_processing_log
  FOR SELECT USING (public.has_role('admin'::app_role));

-- System can insert webhook log entries (via webhooks)
CREATE POLICY "System can insert webhook log" ON public.webhook_processing_log
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- AI GENERATIONS RLS POLICIES
-- =====================================================================

-- Users can view their own AI generations
CREATE POLICY "Users can view own AI generations" ON public.ai_generations
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all AI generations
CREATE POLICY "Admins can view all AI generations" ON public.ai_generations
  FOR SELECT USING (public.has_role('admin'::app_role));

-- System can insert AI generations (via functions)
CREATE POLICY "System can insert AI generations" ON public.ai_generations
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- PRACTICE EXERCISE SETS RLS POLICIES
-- =====================================================================

-- Coaches can view their own exercise sets
CREATE POLICY "Coaches can view own exercise sets" ON public.practice_exercise_sets
  FOR SELECT USING (generated_by = auth.uid());

-- Users can view exercise sets for courses they're enrolled in
CREATE POLICY "Users can view enrolled exercise sets" ON public.practice_exercise_sets
  FOR SELECT USING (
    lesson_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.course_modules cm ON cm.id = l.module_id
      WHERE l.id = practice_exercise_sets.lesson_id AND public.is_enrolled(cm.course_id)
    )
  );

-- Admins can view all exercise sets
CREATE POLICY "Admins can view all exercise sets" ON public.practice_exercise_sets
  FOR SELECT USING (public.has_role('admin'::app_role));

-- Coaches can manage their own exercise sets
CREATE POLICY "Coaches can manage own exercise sets" ON public.practice_exercise_sets
  FOR ALL USING (generated_by = auth.uid());

-- =====================================================================
-- PRACTICE EXERCISE ITEMS RLS POLICIES
-- =====================================================================

-- Access follows parent set access
CREATE POLICY "Exercise items follow set access" ON public.practice_exercise_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.practice_exercise_sets 
      WHERE practice_exercise_sets.id = practice_exercise_items.set_id
    )
  );

-- Coaches can manage items in their own sets
CREATE POLICY "Coaches can manage own exercise items" ON public.practice_exercise_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.practice_exercise_sets 
      WHERE practice_exercise_sets.id = practice_exercise_items.set_id 
        AND practice_exercise_sets.generated_by = auth.uid()
    )
  );

-- =====================================================================
-- CLIENT NOTES RLS POLICIES
-- =====================================================================

-- Users can view their own notes
CREATE POLICY "Users can view own notes" ON public.client_notes
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own notes
CREATE POLICY "Users can insert own notes" ON public.client_notes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own notes
CREATE POLICY "Users can update own notes" ON public.client_notes
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes" ON public.client_notes
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================================
-- CONTENT INTERACTIONS RLS POLICIES
-- =====================================================================

-- Users can view their own interactions
CREATE POLICY "Users can view own interactions" ON public.content_interactions
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own interactions
CREATE POLICY "Users can insert own interactions" ON public.content_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own interactions
CREATE POLICY "Users can update own interactions" ON public.content_interactions
  FOR UPDATE USING (user_id = auth.uid());

-- =====================================================================
-- LESSON COMPLETION ATTEMPTS RLS POLICIES
-- =====================================================================

-- Users can view their own completion attempts
CREATE POLICY "Users can view own completion attempts" ON public.lesson_completion_attempts
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own completion attempts
CREATE POLICY "Users can insert own completion attempts" ON public.lesson_completion_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own completion attempts
CREATE POLICY "Users can update own completion attempts" ON public.lesson_completion_attempts
  FOR UPDATE USING (user_id = auth.uid());

-- =====================================================================
-- LESSON PROGRESS RLS POLICIES
-- =====================================================================

-- Users can view their own lesson progress
CREATE POLICY "Users can view own lesson progress" ON public.lesson_progress
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own lesson progress
CREATE POLICY "Users can insert own lesson progress" ON public.lesson_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own lesson progress
CREATE POLICY "Users can update own lesson progress" ON public.lesson_progress
  FOR UPDATE USING (user_id = auth.uid());

-- Coaches can view progress in their courses
CREATE POLICY "Coaches can view course lesson progress" ON public.lesson_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_progress.lesson_id AND public.is_lesson_coach(l.id)
    )
  );

-- =====================================================================
-- INVOICES RLS POLICIES
-- =====================================================================

-- Users can view their own invoices
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

-- Coaches can view invoices for their subscriptions
CREATE POLICY "Coaches can view subscription invoices" ON public.invoices
  FOR SELECT USING (
    subscription_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.coach_subscriptions 
      WHERE coach_subscriptions.id = invoices.subscription_id 
        AND coach_subscriptions.coach_id = auth.uid()
    )
  );

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices" ON public.invoices
  FOR SELECT USING (public.has_role('admin'::app_role));

-- =====================================================================
-- COACH SETTINGS RLS POLICIES
-- =====================================================================

-- Coaches can view their own settings
CREATE POLICY "Coaches can view own settings" ON public.coach_settings
  FOR SELECT USING (coach_id = auth.uid());

-- Coaches can insert their own settings
CREATE POLICY "Coaches can insert own settings" ON public.coach_settings
  FOR INSERT WITH CHECK (coach_id = auth.uid());

-- Coaches can update their own settings
CREATE POLICY "Coaches can update own settings" ON public.coach_settings
  FOR UPDATE USING (coach_id = auth.uid());

-- Admins can view all coach settings
CREATE POLICY "Admins can view all coach settings" ON public.coach_settings
  FOR SELECT USING (public.has_role('admin'::app_role));

-- =====================================================================
-- RECOMMENDED COURSES RLS POLICIES
-- =====================================================================

-- Everyone can view recommended courses (public discovery)
CREATE POLICY "Everyone can view recommended courses" ON public.recommended_courses
  FOR SELECT USING (true);

-- =====================================================================
-- COURSE CONTENT EMBEDDINGS RLS POLICIES
-- =====================================================================

-- Access follows course access
CREATE POLICY "Content embeddings follow course access" ON public.course_content_embeddings
  FOR SELECT USING (
    course_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_content_embeddings.course_id AND courses.status = 'published'
    ) OR
    public.is_course_coach(course_id) OR
    public.is_enrolled(course_id)
  );

-- =====================================================================
-- COURSE EMBEDDINGS RLS POLICIES
-- =====================================================================

-- Everyone can view embeddings for published courses (for search)
CREATE POLICY "View embeddings of published courses" ON public.course_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = course_embeddings.course_id AND courses.status = 'published'
    )
  );

-- Coaches can view their own course embeddings
CREATE POLICY "Coaches can view own course embeddings" ON public.course_embeddings
  FOR SELECT USING (public.is_course_coach(course_id));

-- Admins can view all embeddings
CREATE POLICY "Admins can view all embeddings" ON public.course_embeddings
  FOR SELECT USING (public.has_role('admin'::app_role));

-- =====================================================================
-- END OF COMPREHENSIVE RLS POLICIES
-- =====================================================================
CREATE POLICY "No direct transaction modifications" ON public.transactions FOR ALL USING (false);

CREATE POLICY "No direct invoice modifications" ON public.invoices FOR ALL USING (false);
