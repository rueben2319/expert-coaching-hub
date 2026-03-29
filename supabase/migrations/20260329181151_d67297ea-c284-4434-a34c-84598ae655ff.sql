
-- 1. Fix lesson_progress: scope DELETE and UPDATE to owner only
DROP POLICY IF EXISTS "progress_delete_v2" ON public.lesson_progress;
DROP POLICY IF EXISTS "progress_update_v2" ON public.lesson_progress;

CREATE POLICY "progress_delete_owner" ON public.lesson_progress
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "progress_update_owner" ON public.lesson_progress
  FOR UPDATE TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- 2. Fix lesson_progress INSERT: scope to owner
DROP POLICY IF EXISTS "progress_insert_v2" ON public.lesson_progress;

CREATE POLICY "progress_insert_owner" ON public.lesson_progress
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- 3. Fix lesson_progress SELECT: scope to owner + coaches of enrolled courses
DROP POLICY IF EXISTS "progress_select_v2" ON public.lesson_progress;

CREATE POLICY "progress_select_owner" ON public.lesson_progress
  FOR SELECT TO authenticated 
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM lessons l
      JOIN course_modules cm ON cm.id = l.module_id
      JOIN courses c ON c.id = cm.course_id
      WHERE l.id = lesson_progress.lesson_id AND c.coach_id = auth.uid()
    )
  );

-- 4. Fix course_certificates INSERT: restrict to service_role only
DROP POLICY IF EXISTS "System can create certificates" ON public.course_certificates;

CREATE POLICY "certificates_insert_service" ON public.course_certificates
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 5. Fix lesson_completion_attempts INSERT: restrict to service_role only
DROP POLICY IF EXISTS "System can insert completion attempts" ON public.lesson_completion_attempts;

CREATE POLICY "completion_attempts_insert_service" ON public.lesson_completion_attempts
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 6. Fix security_audit_log INSERT: restrict to service_role only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_log;

CREATE POLICY "audit_log_insert_service" ON public.security_audit_log
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 7. Fix subscription_audit_log INSERT: restrict to service_role only
DROP POLICY IF EXISTS "System can insert subscription audit logs" ON public.subscription_audit_log;

CREATE POLICY "sub_audit_insert_service" ON public.subscription_audit_log
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 8. Fix profiles trigger INSERT: restrict to service_role only (trigger runs as SECURITY DEFINER)
DROP POLICY IF EXISTS "Allow trigger to insert profiles" ON public.profiles;

CREATE POLICY "profiles_trigger_insert" ON public.profiles
  FOR INSERT TO public
  WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- 9. Fix credit_wallets trigger INSERT: restrict to service_role + owner
DROP POLICY IF EXISTS "Allow trigger to insert credit_wallets" ON public.credit_wallets;

CREATE POLICY "wallets_trigger_insert" ON public.credit_wallets
  FOR INSERT TO public
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- 10. Fix user_roles trigger INSERT: restrict to service_role only
DROP POLICY IF EXISTS "Allow trigger to insert user_roles" ON public.user_roles;

CREATE POLICY "roles_trigger_insert" ON public.user_roles
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');
