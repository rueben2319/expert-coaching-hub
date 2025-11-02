


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'client',
    'coach',
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."content_type" AS ENUM (
    'video',
    'text',
    'quiz',
    'interactive',
    'file'
);


ALTER TYPE "public"."content_type" OWNER TO "postgres";


CREATE TYPE "public"."course_level" AS ENUM (
    'introduction',
    'intermediate',
    'advanced'
);


ALTER TYPE "public"."course_level" OWNER TO "postgres";


CREATE TYPE "public"."course_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."course_status" OWNER TO "postgres";


CREATE TYPE "public"."enrollment_status" AS ENUM (
    'active',
    'completed',
    'dropped'
);


ALTER TYPE "public"."enrollment_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_transaction"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- In a real implementation, this would start a database transaction
  -- For now, we'll just return a success indicator
  -- The actual transaction management is handled by Supabase's built-in mechanisms
  RETURN 'transaction_started';
END;
$$;


ALTER FUNCTION "public"."begin_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_course_progress"("_user_id" "uuid", "_course_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."calculate_course_progress"("_user_id" "uuid", "_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_renewal_date"("_billing_cycle" "text", "_start_date" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."calculate_renewal_date"("_billing_cycle" "text", "_start_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_duplicate_subscription"("_user_id" "uuid", "_coach_id" "uuid", "_package_id" "uuid" DEFAULT NULL::"uuid", "_tier_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Check for active coach subscriptions
  IF _tier_id IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.coach_subscriptions
    WHERE coach_id = _user_id
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


ALTER FUNCTION "public"."check_duplicate_subscription"("_user_id" "uuid", "_coach_id" "uuid", "_package_id" "uuid", "_tier_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_recommendations"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  DELETE FROM public.recommended_courses
  WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_recommendations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commit_transaction"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- In a real implementation, this would commit a database transaction
  -- For now, we'll just return a success indicator
  RETURN 'transaction_committed';
END;
$$;


ALTER FUNCTION "public"."commit_transaction"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."practice_exercise_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "set_id" "uuid" NOT NULL,
    "exercise_type" "text" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text",
    "explanation" "text",
    "choices" "jsonb",
    "difficulty" "text",
    "tags" "text"[],
    "order_index" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb",
    "approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "practice_exercise_items_exercise_type_check" CHECK (("exercise_type" = ANY (ARRAY['multiple_choice'::"text", 'short_answer'::"text", 'fill_in_blank'::"text", 'scenario'::"text", 'flashcard'::"text"])))
);


ALTER TABLE "public"."practice_exercise_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."practice_exercise_items" IS 'Individual practice exercises generated by AI and linked to a set.';



CREATE OR REPLACE FUNCTION "public"."fn_practice_item_coach_access"("item" "public"."practice_exercise_items") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  set_row public.practice_exercise_sets;
BEGIN
  SELECT *
  INTO set_row
  FROM public.practice_exercise_sets
  WHERE id = item.set_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.fn_practice_set_coach_access(set_row);
END;
$$;


ALTER FUNCTION "public"."fn_practice_item_coach_access"("item" "public"."practice_exercise_items") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_practice_item_student_access"("item" "public"."practice_exercise_items") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  set_row public.practice_exercise_sets;
BEGIN
  IF NOT item.approved THEN
    RETURN false;
  END IF;

  SELECT *
  INTO set_row
  FROM public.practice_exercise_sets
  WHERE id = item.set_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.fn_practice_set_student_access(set_row);
END;
$$;


ALTER FUNCTION "public"."fn_practice_item_student_access"("item" "public"."practice_exercise_items") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_exercise_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid",
    "content_id" "uuid",
    "generated_by" "uuid",
    "difficulty" "text",
    "skill_focus" "text",
    "target_audience" "text",
    "model_used" "text",
    "prompt_context" "jsonb",
    "raw_output" "jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    CONSTRAINT "practice_exercise_sets_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['intro'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "practice_exercise_sets_lesson_or_content_chk" CHECK ((("lesson_id" IS NOT NULL) OR ("content_id" IS NOT NULL))),
    CONSTRAINT "practice_exercise_sets_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."practice_exercise_sets" OWNER TO "postgres";


COMMENT ON TABLE "public"."practice_exercise_sets" IS 'Stores AI-generated practice exercise sets for lessons and content.';



CREATE OR REPLACE FUNCTION "public"."fn_practice_set_coach_access"("pes" "public"."practice_exercise_sets") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  coach_id uuid;
BEGIN
  IF pes.generated_by = auth.uid() THEN
    RETURN true;
  END IF;

  IF pes.lesson_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT c.coach_id
  INTO coach_id
  FROM public.lessons l
  JOIN public.course_modules cm ON cm.id = l.module_id
  JOIN public.courses c ON c.id = cm.course_id
  WHERE l.id = pes.lesson_id;

  RETURN coach_id IS NOT NULL AND coach_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."fn_practice_set_coach_access"("pes" "public"."practice_exercise_sets") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_practice_set_student_access"("pes" "public"."practice_exercise_sets") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF pes.status <> 'approved' THEN
    RETURN false;
  END IF;

  IF pes.lesson_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.course_modules cm ON cm.id = l.module_id
    JOIN public.courses c ON c.id = cm.course_id
    JOIN public.course_enrollments ce ON ce.course_id = c.id
    WHERE l.id = pes.lesson_id
      AND ce.user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."fn_practice_set_student_access"("pes" "public"."practice_exercise_sets") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_aged_credits"("p_user_id" "uuid", "p_min_age_days" integer DEFAULT 3) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  aging_date TIMESTAMPTZ;
  aged_amount NUMERIC;
BEGIN
  aging_date := NOW() - (p_min_age_days || ' days')::INTERVAL;
  
  SELECT COALESCE(SUM(amount), 0)
  INTO aged_amount
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND transaction_type IN ('purchase', 'course_earning', 'refund')
    AND created_at <= aging_date;
  
  RETURN aged_amount;
END;
$$;


ALTER FUNCTION "public"."get_aged_credits"("p_user_id" "uuid", "p_min_age_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_aged_credits"("p_user_id" "uuid", "p_min_age_days" integer) IS 'Returns the amount of credits older than specified days (available for withdrawal)';



CREATE OR REPLACE FUNCTION "public"."get_available_withdrawable_credits"("user_id_param" "uuid", "credit_aging_days_param" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_balance integer;
  aged_credits integer;
  aging_date timestamp with time zone;
BEGIN
  -- Get current wallet balance
  SELECT balance INTO current_balance
  FROM credit_wallets
  WHERE user_id = user_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', user_id_param;
  END IF;

  -- Calculate aging cutoff date
  aging_date := now() - interval '1 day' * credit_aging_days_param;

  -- Get sum of aged credits (credits earned before aging period)
  SELECT COALESCE(SUM(amount), 0) INTO aged_credits
  FROM credit_transactions
  WHERE user_id = user_id_param
    AND transaction_type IN ('purchase', 'course_earning', 'refund')
    AND created_at <= aging_date;

  -- Available for withdrawal is the minimum of aged credits and current balance
  -- (to prevent negative results if calculations are off)
  RETURN GREATEST(LEAST(aged_credits, current_balance), 0);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to calculate available withdrawable credits: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."get_available_withdrawable_credits"("user_id_param" "uuid", "credit_aging_days_param" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coach_paychangu_secret"("_coach_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_coach_paychangu_secret"("_coach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_lesson"("_user_id" "uuid", "_course_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_lesson_id UUID;
BEGIN
  SELECT l.id INTO next_lesson_id
  FROM public.lessons l
  JOIN public.course_modules cm ON cm.id = l.module_id
  LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _user_id
  WHERE cm.course_id = _course_id
    AND (lp.is_completed IS NULL OR lp.is_completed = false)
  ORDER BY cm.order_index, l.order_index
  LIMIT 1;

  RETURN next_lesson_id;
END;
$$;


ALTER FUNCTION "public"."get_next_lesson"("_user_id" "uuid", "_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  user_role public.app_role;
BEGIN
  RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
  
  -- Step 1: Create profile
  RAISE LOG 'Step 1: Creating profile for user %', NEW.id;
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();
    RAISE LOG 'Step 1: Profile created successfully for user %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Step 1 FAILED for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
      RAISE EXCEPTION 'Profile creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Step 2: Get and assign role
  RAISE LOG 'Step 2: Assigning role for user %', NEW.id;
  BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client')::public.app_role;
    RAISE LOG 'Step 2a: Role determined as % for user %', user_role, NEW.id;
  EXCEPTION
    WHEN invalid_text_representation THEN
      user_role := 'client'::public.app_role;
      RAISE LOG 'Step 2a: Invalid role in metadata, defaulting to client for user %', NEW.id;
  END;
  
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role)
    ON CONFLICT (user_id) DO UPDATE 
    SET role = EXCLUDED.role;
    RAISE LOG 'Step 2b: Role assigned successfully for user %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Step 2b FAILED for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
      RAISE EXCEPTION 'Role assignment failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Step 3: Initialize credit wallet
  RAISE LOG 'Step 3: Creating credit wallet for user %', NEW.id;
  BEGIN
    INSERT INTO public.credit_wallets (user_id, balance)
    VALUES (NEW.id, 0.00)
    ON CONFLICT (user_id) DO NOTHING;
    RAISE LOG 'Step 3: Credit wallet created successfully for user %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Step 3 FAILED for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
      RAISE EXCEPTION 'Credit wallet creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RAISE LOG 'handle_new_user completed successfully for user %', NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user FATAL ERROR for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Creates profile, assigns role, and initializes credit wallet - with correct search_path';



CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  -- Use a direct query that bypasses RLS by running as the function owner (postgres)
  -- SECURITY DEFINER makes this run with the privileges of the function owner
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") IS 'Checks if a user has a specific role. Runs with SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."initialize_credit_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  INSERT INTO public.credit_wallets (user_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."initialize_credit_wallet"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_credit_wallet"() IS 'DEPRECATED - functionality moved to handle_new_user trigger';



CREATE OR REPLACE FUNCTION "public"."is_subscription_expiring_soon"("_subscription_id" "uuid", "_days_ahead" integer DEFAULT 7) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  renewal_date TIMESTAMPTZ;
  subscription_type TEXT;
BEGIN
  -- Check coach subscriptions
  SELECT renewal_date INTO renewal_date
  FROM public.coach_subscriptions
  WHERE id = _subscription_id
    AND status = 'active';
  
  IF FOUND THEN
    subscription_type := 'coach';
  ELSE
    -- Check client subscriptions
    SELECT renewal_date INTO renewal_date
    FROM public.client_subscriptions
    WHERE id = _subscription_id
      AND status = 'active';
    
    IF FOUND THEN
      subscription_type := 'client';
    ELSE
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check if renewal date is within the specified days
  RETURN renewal_date IS NOT NULL AND renewal_date <= (NOW() + INTERVAL '1 day' * _days_ahead);
END;
$$;


ALTER FUNCTION "public"."is_subscription_expiring_soon"("_subscription_id" "uuid", "_days_ahead" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_role_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'role_change',
    auth.uid(),
    NEW.user_id,
    jsonb_build_object(
      'old_role', OLD.role,
      'new_role', NEW.role,
      'timestamp', now()
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_role_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_subscription_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  subscription_type TEXT;
  user_id UUID;
BEGIN
  -- Determine subscription type and user
  IF TG_TABLE_NAME = 'coach_subscriptions' THEN
    subscription_type := 'coach';
    user_id := NEW.coach_id;
  ELSIF TG_TABLE_NAME = 'client_subscriptions' THEN
    subscription_type := 'client';
    user_id := NEW.client_id;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.subscription_audit_log (
      subscription_id,
      subscription_type,
      old_status,
      new_status,
      changed_by,
      change_reason,
      metadata
    ) VALUES (
      NEW.id,
      subscription_type,
      OLD.status,
      NEW.status,
      user_id,
      'System update',
      jsonb_build_object(
        'billing_cycle', NEW.billing_cycle,
        'renewal_date', NEW.renewal_date,
        'transaction_id', NEW.transaction_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_subscription_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _course_id UUID;
  required_content_count INTEGER;
  completed_content_count INTEGER;
  result BOOLEAN;
BEGIN
  -- Get course_id for this lesson
  SELECT cm.course_id INTO _course_id
  FROM lessons l
  JOIN course_modules cm ON cm.id = l.module_id
  WHERE l.id = _lesson_id;

  -- Count required content items (EXCLUDING videos)
  -- Videos are informational - users prove they watched via quiz
  SELECT COUNT(*) INTO required_content_count
  FROM lesson_content
  WHERE lesson_id = _lesson_id 
    AND is_required = true
    AND content_type != 'video';

  -- Count completed required content items (EXCLUDING videos)
  SELECT COUNT(*) INTO completed_content_count
  FROM lesson_content lc
  JOIN content_interactions ci ON ci.content_id = lc.id
  WHERE lc.lesson_id = _lesson_id
    AND lc.is_required = true
    AND lc.content_type != 'video'
    AND ci.user_id = _user_id
    AND ci.is_completed = true;

  -- Determine if lesson should be marked complete
  result := (required_content_count = completed_content_count) AND (required_content_count > 0);

  -- Log the attempt (helpful for debugging)
  INSERT INTO lesson_completion_attempts (
    user_id, lesson_id, success, required_count, completed_count, details
  ) VALUES (
    _user_id, 
    _lesson_id, 
    result, 
    required_content_count, 
    completed_content_count,
    jsonb_build_object(
      'course_id', _course_id,
      'timestamp', now(),
      'note', 'Videos excluded from progress tracking'
    )
  );

  -- Only mark as complete if all required content is completed
  IF result THEN
    INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at)
    VALUES (_user_id, _lesson_id, true, now())
    ON CONFLICT (user_id, lesson_id)
    DO UPDATE SET is_completed = true, completed_at = now();

    -- Recalculate course progress
    PERFORM calculate_course_progress(_user_id, _course_id);
    
    RETURN true;
  ELSE
    -- Still create/update progress record but keep is_completed as false
    INSERT INTO lesson_progress (user_id, lesson_id, is_completed, started_at)
    VALUES (_user_id, _lesson_id, false, now())
    ON CONFLICT (user_id, lesson_id)
    DO UPDATE SET started_at = COALESCE(lesson_progress.started_at, now());
    
    RETURN false;
  END IF;
END;
$$;


ALTER FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") IS 'Marks a lesson as complete if all required NON-VIDEO content is done. Videos are informational - users prove comprehension via quiz.';



CREATE OR REPLACE FUNCTION "public"."process_withdrawal"("coach_id" "uuid", "credits_amount" integer, "amount_mwk" integer, "withdrawal_id" "uuid", "payout_ref" "text" DEFAULT NULL::"text", "payout_trans_id" "text" DEFAULT NULL::"text", "payment_method" "text" DEFAULT 'mobile_money'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  wallet_record record;
  new_balance integer;
  transaction_id uuid;
BEGIN
  -- Start transaction
  -- Get current wallet balance with row lock
  SELECT * INTO wallet_record
  FROM credit_wallets
  WHERE user_id = coach_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', coach_id;
  END IF;

  -- Check sufficient balance
  IF wallet_record.balance < credits_amount THEN
    RAISE EXCEPTION 'Insufficient balance: % < %', wallet_record.balance, credits_amount;
  END IF;

  -- Calculate new balance
  new_balance := wallet_record.balance - credits_amount;

  -- Update wallet balance
  UPDATE credit_wallets
  SET balance = new_balance, updated_at = now()
  WHERE user_id = coach_id;

  -- Insert transaction record
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    coach_id,
    'withdrawal',
    -credits_amount,
    wallet_record.balance,
    new_balance,
    'withdrawal_request',
    withdrawal_id,
    format('Immediate withdrawal: %s credits → %s MWK via PayChangu', credits_amount, amount_mwk),
    json_build_object(
      'payment_method', payment_method,
      'amount_mwk', amount_mwk,
      'payout_ref', payout_ref,
      'payout_trans_id', payout_trans_id
    )
  ) RETURNING id INTO transaction_id;

  -- Update withdrawal request status
  UPDATE withdrawal_requests
  SET
    status = 'completed',
    processed_at = now(),
    processed_by = coach_id
  WHERE id = withdrawal_id;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'new_balance', new_balance,
    'transaction_id', transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automatically happens
    RAISE EXCEPTION 'Withdrawal processing failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."process_withdrawal"("coach_id" "uuid", "credits_amount" integer, "amount_mwk" integer, "withdrawal_id" "uuid", "payout_ref" "text", "payout_trans_id" "text", "payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_failed_withdrawal"("coach_id" "uuid", "credits_amount" integer, "withdrawal_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  wallet_record record;
  new_balance integer;
  transaction_id uuid;
BEGIN
  -- Get current wallet balance
  SELECT * INTO wallet_record
  FROM credit_wallets
  WHERE user_id = coach_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', coach_id;
  END IF;

  -- Calculate new balance (refund)
  new_balance := wallet_record.balance + credits_amount;

  -- Update wallet balance
  UPDATE credit_wallets
  SET balance = new_balance, updated_at = now()
  WHERE user_id = coach_id;

  -- Insert refund transaction record
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    coach_id,
    'refund',
    credits_amount,
    wallet_record.balance,
    new_balance,
    'withdrawal_request',
    withdrawal_id,
    format('Refund for failed withdrawal: %s credits', credits_amount),
    json_build_object(
      'refund_reason', 'withdrawal_failure',
      'original_credits', credits_amount
    )
  ) RETURNING id INTO transaction_id;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'new_balance', new_balance,
    'transaction_id', transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Refund processing failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."refund_failed_withdrawal"("coach_id" "uuid", "credits_amount" integer, "withdrawal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_transaction"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- In a real implementation, this would rollback a database transaction
  -- For now, we'll just return a success indicator
  RETURN 'transaction_rolled_back';
END;
$$;


ALTER FUNCTION "public"."rollback_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_credits"("from_user_id" "uuid", "to_user_id" "uuid", "amount" numeric, "transaction_type" character varying, "reference_type" character varying DEFAULT NULL::character varying, "reference_id" "uuid" DEFAULT NULL::"uuid", "description" "text" DEFAULT NULL::"text", "metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sender_wallet credit_wallets%ROWTYPE;
  receiver_wallet credit_wallets%ROWTYPE;
  sender_transaction_id UUID;
  receiver_transaction_id UUID;
BEGIN
  -- Validate amount
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Lock and get sender wallet
  SELECT * INTO sender_wallet
  FROM credit_wallets
  WHERE user_id = from_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;

  IF sender_wallet.balance < amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Lock and get receiver wallet
  SELECT * INTO receiver_wallet
  FROM credit_wallets
  WHERE user_id = to_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiver wallet not found';
  END IF;

  -- Deduct from sender
  UPDATE credit_wallets
  SET 
    balance = balance - amount,
    total_spent = total_spent + amount,
    updated_at = NOW()
  WHERE user_id = from_user_id;

  -- Add to receiver
  UPDATE credit_wallets
  SET 
    balance = balance + amount,
    total_earned = total_earned + amount,
    updated_at = NOW()
  WHERE user_id = to_user_id;

  -- Create sender transaction record
  INSERT INTO credit_transactions (
    user_id, transaction_type, amount,
    balance_before, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    from_user_id, transaction_type, -amount,
    sender_wallet.balance, sender_wallet.balance - amount,
    reference_type, reference_id, description, metadata
  ) RETURNING id INTO sender_transaction_id;

  -- Create receiver transaction record
  INSERT INTO credit_transactions (
    user_id, transaction_type, amount,
    balance_before, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    to_user_id, 'course_earning', amount,
    receiver_wallet.balance, receiver_wallet.balance + amount,
    reference_type, reference_id, description, metadata
  ) RETURNING id INTO receiver_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'sender_transaction_id', sender_transaction_id,
    'receiver_transaction_id', receiver_transaction_id,
    'amount', amount
  );
END;
$$;


ALTER FUNCTION "public"."transfer_credits"("from_user_id" "uuid", "to_user_id" "uuid", "amount" numeric, "transaction_type" character varying, "reference_type" character varying, "reference_id" "uuid", "description" "text", "metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."transfer_credits"("from_user_id" "uuid", "to_user_id" "uuid", "amount" numeric, "transaction_type" character varying, "reference_type" character varying, "reference_id" "uuid", "description" "text", "metadata" "jsonb") IS 'Safely transfers credits between users with full audit trail';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_own_role"("p_role" "public"."app_role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id uuid;
  v_existing public.user_roles%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Identify the caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no auth.uid()';
  END IF;

  -- Validate input
  IF p_role IS NULL THEN
    RAISE EXCEPTION 'Role must not be null';
  END IF;

  -- Upsert the caller's role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, p_role)
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_existing;

  -- Also mirror to auth metadata (best-effort; ignore failures)
  PERFORM
    auth.set_claim(
      v_user_id,
      'user_metadata',
      jsonb_set(
        COALESCE((select raw_user_meta_data from auth.users where id = v_user_id), '{}'::jsonb),
        '{role}',
        to_jsonb(p_role::text),
        true
      )
    )
  ;

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


ALTER FUNCTION "public"."upsert_own_role"("p_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_subscription_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only allow specific status transitions
  IF OLD.status = 'pending' AND NEW.status NOT IN ('active', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
  END IF;
  
  IF OLD.status = 'active' AND NEW.status NOT IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Invalid status transition from active to %', NEW.status;
  END IF;
  
  IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status from cancelled to %', NEW.status;
  END IF;
  
  IF OLD.status = 'expired' AND NEW.status NOT IN ('active', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from expired to %', NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_subscription_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_transaction_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."validate_transaction_status_transition"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "actor_role" "text",
    "action_key" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "response" "text",
    "response_format" "text" DEFAULT 'markdown'::"text",
    "tokens_prompt" integer DEFAULT 0,
    "tokens_completion" integer DEFAULT 0,
    "provider" "text" DEFAULT 'openai'::"text",
    "model" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_generations_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['coach'::"text", 'client'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."ai_generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "lesson_id" "uuid",
    "content_id" "uuid",
    "source" "text" DEFAULT 'manual'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "note_text" "text" NOT NULL,
    "ai_summary" "text",
    "is_ai_generated" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_notes" IS 'Stores learner notes with optional AI-generated summaries';



CREATE TABLE IF NOT EXISTS "public"."coach_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "paychangu_secret_key" "text",
    "paychangu_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" timestamp with time zone,
    "renewal_date" timestamp with time zone,
    "transaction_id" "text",
    "payment_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "coach_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'expired'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."coach_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content_id" "uuid" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "interaction_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_content_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid",
    "content_id" "uuid",
    "embedding" "public"."vector"(1536),
    "chunk" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_content_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "embedding" "public"."vector"(1536),
    "content_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_embeddings" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_embeddings" IS 'Stores vector embeddings for semantic course search';



CREATE TABLE IF NOT EXISTS "public"."course_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "status" "public"."enrollment_status" DEFAULT 'active'::"public"."enrollment_status" NOT NULL,
    "progress_percentage" integer DEFAULT 0 NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "credits_paid" numeric(10,2) DEFAULT 0.00,
    "payment_status" character varying(50) DEFAULT 'free'::character varying,
    "credit_transaction_id" "uuid"
);


ALTER TABLE "public"."course_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."course_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "status" "public"."course_status" DEFAULT 'draft'::"public"."course_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" "public"."course_level",
    "tag" "text",
    "category" "text",
    "price_credits" numeric(10,2) DEFAULT 0.00,
    "is_free" boolean DEFAULT true,
    CONSTRAINT "positive_price_credits" CHECK (("price_credits" >= (0)::numeric))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."courses"."price_credits" IS 'Course price in credits (0 = free)';



COMMENT ON COLUMN "public"."courses"."is_free" IS 'Whether course is free or paid';



CREATE TABLE IF NOT EXISTS "public"."credit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "credits" numeric(10,2) NOT NULL,
    "price_mwk" integer NOT NULL,
    "bonus_credits" numeric(10,2) DEFAULT 0.00,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "positive_credits" CHECK (("credits" > (0)::numeric)),
    CONSTRAINT "positive_price" CHECK (("price_mwk" > 0))
);


ALTER TABLE "public"."credit_packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_packages" IS 'Available credit bundles users can purchase. Seeded with 5 default packages.';



CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" character varying(50) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "balance_before" numeric(10,2) NOT NULL,
    "balance_after" numeric(10,2) NOT NULL,
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "description" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_transaction_type" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['purchase'::character varying, 'course_payment'::character varying, 'course_earning'::character varying, 'withdrawal'::character varying, 'refund'::character varying, 'admin_adjustment'::character varying])::"text"[])))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_transactions" IS 'Audit log of all credit movements';



CREATE TABLE IF NOT EXISTS "public"."credit_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "total_earned" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "total_spent" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "positive_balance" CHECK (("balance" >= (0)::numeric))
);


ALTER TABLE "public"."credit_wallets" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_wallets" IS 'Stores credit balance for each user - RLS enabled';



CREATE SEQUENCE IF NOT EXISTS "public"."invoice_sequence"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_sequence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "order_id" "uuid",
    "subscription_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'MWK'::"text" NOT NULL,
    "invoice_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_method" "text",
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_subscription_id" "uuid",
    "transaction_id" "uuid",
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lesson_completion_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "success" boolean NOT NULL,
    "required_count" integer NOT NULL,
    "completed_count" integer NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."lesson_completion_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."lesson_completion_attempts" IS 'Audit log of lesson completion attempts for debugging';



CREATE TABLE IF NOT EXISTS "public"."lesson_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "content_type" "public"."content_type" NOT NULL,
    "content_data" "jsonb" NOT NULL,
    "order_index" integer NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lesson_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lesson_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."lesson_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "estimated_duration" integer,
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid",
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "meeting_analytics_event_type_check" CHECK (("event_type" = ANY (ARRAY['meeting_created'::"text", 'meeting_joined'::"text", 'meeting_left'::"text", 'join_clicked'::"text", 'chat_message_sent'::"text", 'meeting_cancelled'::"text"])))
);


ALTER TABLE "public"."meeting_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_chat" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."meeting_chat" REPLICA IDENTITY FULL;


ALTER TABLE "public"."meeting_chat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "summary" "text" NOT NULL,
    "description" "text",
    "meet_link" "text",
    "calendar_event_id" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'scheduled'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "meetings_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommended_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recommended_course_id" "uuid" NOT NULL,
    "source_course_id" "uuid",
    "similarity_score" double precision,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval)
);


ALTER TABLE "public"."recommended_courses" OWNER TO "postgres";


COMMENT ON TABLE "public"."recommended_courses" IS 'Caches course recommendations for users';



CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "target_user_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "subscription_type" "text" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid",
    "change_reason" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_monthly" numeric(10,2) NOT NULL,
    "price_yearly" numeric(10,2) NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "max_courses" integer,
    "max_students" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_ref" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'MWK'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "gateway_response" "jsonb",
    "order_id" "uuid",
    "subscription_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transaction_mode" character varying(50) DEFAULT 'coach_subscription'::character varying,
    "credit_package_id" "uuid",
    "credits_amount" numeric(10,2),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_role_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_role_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_role_assignment" CHECK (("role" = ANY (ARRAY['client'::"public"."app_role", 'coach'::"public"."app_role", 'admin'::"public"."app_role"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_practice_exercise_coach_scope" AS
 SELECT "pes"."id" AS "set_id",
    "c"."coach_id",
    "pes"."generated_by"
   FROM ((("public"."practice_exercise_sets" "pes"
     LEFT JOIN "public"."lessons" "l" ON (("l"."id" = "pes"."lesson_id")))
     LEFT JOIN "public"."course_modules" "cm" ON (("cm"."id" = "l"."module_id")))
     LEFT JOIN "public"."courses" "c" ON (("c"."id" = "cm"."course_id")));


ALTER VIEW "public"."v_practice_exercise_coach_scope" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_practice_exercise_coach_scope" IS 'Helper view to scope practice exercise sets to owning coach for RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."webhook_processing_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tx_ref" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhook_processing_log_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."webhook_processing_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."withdrawal_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "credits_amount" numeric(10,2) NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "payment_method" character varying(50) DEFAULT 'bank_transfer'::character varying NOT NULL,
    "payment_details" "jsonb" NOT NULL,
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "rejection_reason" "text",
    "transaction_ref" character varying(255),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fraud_score" integer DEFAULT 0,
    "fraud_reasons" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    CONSTRAINT "positive_amount" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."withdrawal_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."withdrawal_requests" IS 'Coach requests to withdraw earnings';



COMMENT ON COLUMN "public"."withdrawal_requests"."fraud_score" IS 'Automated fraud detection score (0-100, higher = more suspicious)';



COMMENT ON COLUMN "public"."withdrawal_requests"."fraud_reasons" IS 'Array of reasons contributing to fraud score';



CREATE OR REPLACE VIEW "public"."withdrawal_analytics" WITH ("security_invoker"='true') AS
 SELECT "coach_id",
    "count"(*) AS "total_requests",
    "count"(*) FILTER (WHERE (("status")::"text" = 'completed'::"text")) AS "completed_count",
    "count"(*) FILTER (WHERE (("status")::"text" = 'failed'::"text")) AS "failed_count",
    "count"(*) FILTER (WHERE (("status")::"text" = 'processing'::"text")) AS "processing_count",
    "sum"("credits_amount") AS "total_credits_requested",
    "sum"(
        CASE
            WHEN (("status")::"text" = 'completed'::"text") THEN "credits_amount"
            ELSE (0)::numeric
        END) AS "total_credits_withdrawn",
    "avg"("fraud_score") AS "avg_fraud_score",
    "max"("created_at") AS "last_request_at",
    "min"("created_at") AS "first_request_at"
   FROM "public"."withdrawal_requests"
  GROUP BY "coach_id";


ALTER VIEW "public"."withdrawal_analytics" OWNER TO "postgres";


COMMENT ON VIEW "public"."withdrawal_analytics" IS 'Aggregated withdrawal statistics per coach for monitoring';



ALTER TABLE ONLY "public"."ai_generations"
    ADD CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_settings"
    ADD CONSTRAINT "coach_settings_coach_id_key" UNIQUE ("coach_id");



ALTER TABLE ONLY "public"."coach_settings"
    ADD CONSTRAINT "coach_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_subscriptions"
    ADD CONSTRAINT "coach_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "content_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "content_interactions_user_id_content_id_key" UNIQUE ("user_id", "content_id");



ALTER TABLE ONLY "public"."course_content_embeddings"
    ADD CONSTRAINT "course_content_embeddings_lesson_id_content_id_key" UNIQUE ("lesson_id", "content_id");



ALTER TABLE ONLY "public"."course_content_embeddings"
    ADD CONSTRAINT "course_content_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_embeddings"
    ADD CONSTRAINT "course_embeddings_course_id_key" UNIQUE ("course_id");



ALTER TABLE ONLY "public"."course_embeddings"
    ADD CONSTRAINT "course_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_course_id_order_index_key" UNIQUE ("course_id", "order_index");



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_packages"
    ADD CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."lesson_completion_attempts"
    ADD CONSTRAINT "lesson_completion_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_content"
    ADD CONSTRAINT "lesson_content_lesson_id_order_index_key" UNIQUE ("lesson_id", "order_index");



ALTER TABLE ONLY "public"."lesson_content"
    ADD CONSTRAINT "lesson_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_user_id_lesson_id_key" UNIQUE ("user_id", "lesson_id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_order_index_key" UNIQUE ("module_id", "order_index");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_analytics"
    ADD CONSTRAINT "meeting_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_chat"
    ADD CONSTRAINT "meeting_chat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_calendar_event_id_key" UNIQUE ("calendar_event_id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_exercise_items"
    ADD CONSTRAINT "practice_exercise_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_exercise_sets"
    ADD CONSTRAINT "practice_exercise_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommended_courses"
    ADD CONSTRAINT "recommended_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_audit_log"
    ADD CONSTRAINT "subscription_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_transaction_ref_key" UNIQUE ("transaction_ref");



ALTER TABLE ONLY "public"."user_role_changes"
    ADD CONSTRAINT "user_role_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."webhook_processing_log"
    ADD CONSTRAINT "webhook_processing_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."withdrawal_requests"
    ADD CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_generations_user_created_idx" ON "public"."ai_generations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "client_notes_user_created_idx" ON "public"."client_notes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "course_content_embeddings_embedding_idx" ON "public"."course_content_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "course_content_embeddings_lesson_idx" ON "public"."course_content_embeddings" USING "btree" ("lesson_id");



CREATE INDEX "idx_client_notes_content_id" ON "public"."client_notes" USING "btree" ("content_id");



CREATE INDEX "idx_client_notes_created_at" ON "public"."client_notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_client_notes_lesson_id" ON "public"."client_notes" USING "btree" ("lesson_id");



CREATE INDEX "idx_client_notes_user_id" ON "public"."client_notes" USING "btree" ("user_id");



CREATE INDEX "idx_coach_subscriptions_coach_id" ON "public"."coach_subscriptions" USING "btree" ("coach_id");



CREATE INDEX "idx_coach_subscriptions_status" ON "public"."coach_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_content_interactions_completed" ON "public"."content_interactions" USING "btree" ("is_completed");



CREATE INDEX "idx_content_interactions_content_id" ON "public"."content_interactions" USING "btree" ("content_id");



CREATE INDEX "idx_content_interactions_user_id" ON "public"."content_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_course_embeddings_course_id" ON "public"."course_embeddings" USING "btree" ("course_id");



CREATE INDEX "idx_course_embeddings_vector" ON "public"."course_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_courses_category" ON "public"."courses" USING "btree" ("category");



CREATE INDEX "idx_courses_level" ON "public"."courses" USING "btree" ("level");



CREATE INDEX "idx_courses_price_credits" ON "public"."courses" USING "btree" ("price_credits");



CREATE INDEX "idx_courses_tag" ON "public"."courses" USING "btree" ("tag");



CREATE INDEX "idx_credit_transactions_aging" ON "public"."credit_transactions" USING "btree" ("user_id", "created_at" DESC) WHERE (("transaction_type")::"text" = ANY ((ARRAY['purchase'::character varying, 'course_earning'::character varying, 'refund'::character varying])::"text"[]));



CREATE INDEX "idx_credit_transactions_created_at" ON "public"."credit_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_transactions_type" ON "public"."credit_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_credit_transactions_user_id" ON "public"."credit_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_credit_transactions_user_type_created" ON "public"."credit_transactions" USING "btree" ("user_id", "transaction_type", "created_at" DESC);



COMMENT ON INDEX "public"."idx_credit_transactions_user_type_created" IS 'Optimizes credit aging and fraud detection queries';



CREATE INDEX "idx_credit_wallets_user_id" ON "public"."credit_wallets" USING "btree" ("user_id");



CREATE INDEX "idx_invoices_client_subscription_id" ON "public"."invoices" USING "btree" ("client_subscription_id");



CREATE INDEX "idx_invoices_transaction_id" ON "public"."invoices" USING "btree" ("transaction_id");



CREATE INDEX "idx_invoices_user_id" ON "public"."invoices" USING "btree" ("user_id");



CREATE INDEX "idx_lesson_completion_attempted_at" ON "public"."lesson_completion_attempts" USING "btree" ("attempted_at" DESC);



CREATE INDEX "idx_lesson_completion_lesson_id" ON "public"."lesson_completion_attempts" USING "btree" ("lesson_id");



CREATE INDEX "idx_lesson_completion_success" ON "public"."lesson_completion_attempts" USING "btree" ("success");



CREATE INDEX "idx_lesson_completion_user_id" ON "public"."lesson_completion_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_meeting_analytics_event_type" ON "public"."meeting_analytics" USING "btree" ("event_type");



CREATE INDEX "idx_meeting_analytics_meeting_id" ON "public"."meeting_analytics" USING "btree" ("meeting_id");



CREATE INDEX "idx_meeting_chat_meeting_id" ON "public"."meeting_chat" USING "btree" ("meeting_id");



CREATE INDEX "idx_meetings_start_time" ON "public"."meetings" USING "btree" ("start_time");



CREATE INDEX "idx_meetings_status" ON "public"."meetings" USING "btree" ("status");



CREATE INDEX "idx_meetings_user_id" ON "public"."meetings" USING "btree" ("user_id");



CREATE INDEX "idx_practice_exercise_items_set" ON "public"."practice_exercise_items" USING "btree" ("set_id");



CREATE INDEX "idx_practice_exercise_items_type" ON "public"."practice_exercise_items" USING "btree" ("exercise_type");



CREATE INDEX "idx_practice_exercise_sets_generated_by" ON "public"."practice_exercise_sets" USING "btree" ("generated_by");



CREATE INDEX "idx_practice_exercise_sets_lesson" ON "public"."practice_exercise_sets" USING "btree" ("lesson_id");



CREATE INDEX "idx_recommended_courses_expires_at" ON "public"."recommended_courses" USING "btree" ("expires_at");



CREATE INDEX "idx_recommended_courses_user_id" ON "public"."recommended_courses" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_fraud_check" ON "public"."transactions" USING "btree" ("user_id", "transaction_mode", "status", "created_at" DESC) WHERE ((("transaction_mode")::"text" = 'credit_purchase'::"text") AND ("status" = 'success'::"text"));



CREATE INDEX "idx_transactions_rate_limit" ON "public"."transactions" USING "btree" ("user_id", "transaction_mode", "created_at" DESC) WHERE (("transaction_mode")::"text" = 'credit_purchase'::"text");



CREATE INDEX "idx_transactions_ref" ON "public"."transactions" USING "btree" ("transaction_ref");



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_user_mode_created" ON "public"."transactions" USING "btree" ("user_id", "transaction_mode", "created_at" DESC);



CREATE INDEX "idx_transactions_user_status" ON "public"."transactions" USING "btree" ("user_id", "status");



CREATE INDEX "idx_webhook_processing_log_created_at" ON "public"."webhook_processing_log" USING "btree" ("created_at");



CREATE INDEX "idx_webhook_processing_log_status" ON "public"."webhook_processing_log" USING "btree" ("status");



CREATE INDEX "idx_webhook_processing_log_tx_ref" ON "public"."webhook_processing_log" USING "btree" ("tx_ref");



CREATE INDEX "idx_withdrawal_requests_coach_created" ON "public"."withdrawal_requests" USING "btree" ("coach_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_withdrawal_requests_coach_created" IS 'Optimizes rate limiting queries for withdrawal requests';



CREATE INDEX "idx_withdrawal_requests_coach_id" ON "public"."withdrawal_requests" USING "btree" ("coach_id");



CREATE INDEX "idx_withdrawal_requests_rate_limit" ON "public"."withdrawal_requests" USING "btree" ("coach_id", "created_at" DESC) WHERE (("status")::"text" = ANY ((ARRAY['completed'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "idx_withdrawal_requests_status" ON "public"."withdrawal_requests" USING "btree" ("status");



CREATE INDEX "idx_withdrawal_requests_status_created" ON "public"."withdrawal_requests" USING "btree" ("coach_id", "status", "created_at" DESC);



CREATE INDEX "subscription_audit_log_created_at_idx" ON "public"."subscription_audit_log" USING "btree" ("created_at");



CREATE INDEX "subscription_audit_log_subscription_id_idx" ON "public"."subscription_audit_log" USING "btree" ("subscription_id");



CREATE INDEX "subscription_audit_log_subscription_type_idx" ON "public"."subscription_audit_log" USING "btree" ("subscription_type");



CREATE OR REPLACE TRIGGER "audit_role_changes" AFTER UPDATE OF "role" ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."log_role_change"();



CREATE OR REPLACE TRIGGER "log_coach_subscription_status_change" AFTER UPDATE ON "public"."coach_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."log_subscription_status_change"();



CREATE OR REPLACE TRIGGER "on_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "practice_exercise_items_updated_at" BEFORE UPDATE ON "public"."practice_exercise_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "practice_exercise_sets_updated_at" BEFORE UPDATE ON "public"."practice_exercise_sets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_log_subscription_status_change" AFTER UPDATE OF "status" ON "public"."coach_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."log_subscription_status_change"();



CREATE OR REPLACE TRIGGER "update_client_notes_updated_at" BEFORE UPDATE ON "public"."client_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_coach_settings_updated_at" BEFORE UPDATE ON "public"."coach_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_coach_subscriptions_updated_at" BEFORE UPDATE ON "public"."coach_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_content_interactions_updated_at" BEFORE UPDATE ON "public"."content_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_course_embeddings_updated_at" BEFORE UPDATE ON "public"."course_embeddings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_course_modules_updated_at" BEFORE UPDATE ON "public"."course_modules" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_courses_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_lesson_content_updated_at" BEFORE UPDATE ON "public"."lesson_content" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_lessons_updated_at" BEFORE UPDATE ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_meetings_updated_at" BEFORE UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_tiers_updated_at" BEFORE UPDATE ON "public"."tiers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_webhook_processing_log_updated_at" BEFORE UPDATE ON "public"."webhook_processing_log" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "validate_coach_subscription_status_transition_trigger" BEFORE UPDATE ON "public"."coach_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_subscription_status_transition"();



CREATE OR REPLACE TRIGGER "validate_transaction_status_transition_trigger" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_transaction_status_transition"();



ALTER TABLE ONLY "public"."ai_generations"
    ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."lesson_content"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_settings"
    ADD CONSTRAINT "coach_settings_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_subscriptions"
    ADD CONSTRAINT "coach_subscriptions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "content_interactions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."lesson_content"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_content_embeddings"
    ADD CONSTRAINT "course_content_embeddings_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."lesson_content"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_content_embeddings"
    ADD CONSTRAINT "course_content_embeddings_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_embeddings"
    ADD CONSTRAINT "course_embeddings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_credit_transaction_id_fkey" FOREIGN KEY ("credit_transaction_id") REFERENCES "public"."credit_transactions"("id");



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_completion_attempts"
    ADD CONSTRAINT "fk_lesson_completion_lesson" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_completion_attempts"
    ADD CONSTRAINT "fk_lesson_completion_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."coach_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lesson_completion_attempts"
    ADD CONSTRAINT "lesson_completion_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_completion_attempts"
    ADD CONSTRAINT "lesson_completion_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_content"
    ADD CONSTRAINT "lesson_content_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_analytics"
    ADD CONSTRAINT "meeting_analytics_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_analytics"
    ADD CONSTRAINT "meeting_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_chat"
    ADD CONSTRAINT "meeting_chat_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_chat"
    ADD CONSTRAINT "meeting_chat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_exercise_items"
    ADD CONSTRAINT "practice_exercise_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."practice_exercise_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_exercise_sets"
    ADD CONSTRAINT "practice_exercise_sets_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."lesson_content"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."practice_exercise_sets"
    ADD CONSTRAINT "practice_exercise_sets_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."practice_exercise_sets"
    ADD CONSTRAINT "practice_exercise_sets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommended_courses"
    ADD CONSTRAINT "recommended_courses_recommended_course_id_fkey" FOREIGN KEY ("recommended_course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommended_courses"
    ADD CONSTRAINT "recommended_courses_source_course_id_fkey" FOREIGN KEY ("source_course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recommended_courses"
    ADD CONSTRAINT "recommended_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscription_audit_log"
    ADD CONSTRAINT "subscription_audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_credit_package_id_fkey" FOREIGN KEY ("credit_package_id") REFERENCES "public"."credit_packages"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."coach_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_role_changes"
    ADD CONSTRAINT "user_role_changes_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_role_changes"
    ADD CONSTRAINT "user_role_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."withdrawal_requests"
    ADD CONSTRAINT "withdrawal_requests_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."withdrawal_requests"
    ADD CONSTRAINT "withdrawal_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins and self can view role changes" ON "public"."user_role_changes" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Admins can delete role changes" ON "public"."user_role_changes" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert role changes" ON "public"."user_role_changes" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all withdrawal requests" ON "public"."withdrawal_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage packages" ON "public"."credit_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all credit balances" ON "public"."credit_wallets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all transactions" ON "public"."credit_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view subscription audit logs" ON "public"."subscription_audit_log" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Allow trigger to insert credit_wallets" ON "public"."credit_wallets" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow trigger to insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow trigger to insert user_roles" ON "public"."user_roles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active packages" ON "public"."credit_packages" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view embeddings for published courses" ON "public"."course_embeddings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "course_embeddings"."course_id") AND ("courses"."status" = 'published'::"public"."course_status")))));



CREATE POLICY "Authenticated users can view limited profile data" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."course_enrollments" "ce1"
     JOIN "public"."course_enrollments" "ce2" ON (("ce1"."course_id" = "ce2"."course_id")))
  WHERE (("ce1"."user_id" = "auth"."uid"()) AND ("ce2"."user_id" = "profiles"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."courses" "c"
     JOIN "public"."course_enrollments" "ce" ON (("ce"."course_id" = "c"."id")))
  WHERE (("c"."coach_id" = "auth"."uid"()) AND ("ce"."user_id" = "profiles"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."courses" "c"
     JOIN "public"."course_enrollments" "ce" ON (("ce"."course_id" = "c"."id")))
  WHERE (("ce"."user_id" = "auth"."uid"()) AND ("c"."coach_id" = "profiles"."id"))))));



CREATE POLICY "Clients can view published courses" ON "public"."courses" FOR SELECT USING ((("status" = 'published'::"public"."course_status") OR "public"."has_role"("auth"."uid"(), 'client'::"public"."app_role")));



CREATE POLICY "Coaches can create courses" ON "public"."courses" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role"));



CREATE POLICY "Coaches can create meetings" ON "public"."meetings" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))));



CREATE POLICY "Coaches can create withdrawal requests" ON "public"."withdrawal_requests" FOR INSERT WITH CHECK ((("coach_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['coach'::"public"."app_role", 'admin'::"public"."app_role"])))))));



CREATE POLICY "Coaches can delete their own courses" ON "public"."courses" FOR DELETE USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can insert their own settings" ON "public"."coach_settings" FOR INSERT WITH CHECK ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can insert their own subscriptions" ON "public"."coach_subscriptions" FOR INSERT WITH CHECK ((("coach_id" = "auth"."uid"()) AND "public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role")));



CREATE POLICY "Coaches can manage embeddings for their courses" ON "public"."course_embeddings" USING ((EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "course_embeddings"."course_id") AND ("courses"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage their course modules" ON "public"."course_modules" USING ((EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "course_modules"."course_id") AND (("courses"."coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))))));



CREATE POLICY "Coaches can manage their lesson content" ON "public"."lesson_content" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons"
     JOIN "public"."course_modules" ON (("course_modules"."id" = "lessons"."module_id")))
     JOIN "public"."courses" ON (("courses"."id" = "course_modules"."course_id")))
  WHERE (("lessons"."id" = "lesson_content"."lesson_id") AND (("courses"."coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))))));



CREATE POLICY "Coaches can manage their lessons" ON "public"."lessons" USING ((EXISTS ( SELECT 1
   FROM ("public"."course_modules"
     JOIN "public"."courses" ON (("courses"."id" = "course_modules"."course_id")))
  WHERE (("course_modules"."id" = "lessons"."module_id") AND (("courses"."coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))))));



CREATE POLICY "Coaches can update their own courses" ON "public"."courses" FOR UPDATE USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can update their own pending requests" ON "public"."withdrawal_requests" FOR UPDATE USING ((("coach_id" = "auth"."uid"()) AND (("status")::"text" = 'pending'::"text")));



CREATE POLICY "Coaches can update their own settings" ON "public"."coach_settings" FOR UPDATE USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can update their own subscriptions" ON "public"."coach_subscriptions" FOR UPDATE USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can view analytics for their meetings" ON "public"."meeting_analytics" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_analytics"."meeting_id") AND ("m"."user_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can view enrollments for their courses" ON "public"."course_enrollments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "course_enrollments"."course_id") AND ("courses"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can view student notes in their courses" ON "public"."client_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."course_modules" "cm" ON (("l"."module_id" = "cm"."id")))
     JOIN "public"."courses" "c" ON (("cm"."course_id" = "c"."id")))
  WHERE (("l"."id" = "client_notes"."lesson_id") AND ("c"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can view their own courses" ON "public"."courses" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can view their own settings" ON "public"."coach_settings" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can view their own subscriptions" ON "public"."coach_subscriptions" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coaches can view their own withdrawal requests" ON "public"."withdrawal_requests" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches manage own practice items" ON "public"."practice_exercise_items" USING ("public"."fn_practice_item_coach_access"("practice_exercise_items".*)) WITH CHECK ("public"."fn_practice_item_coach_access"("practice_exercise_items".*));



CREATE POLICY "Coaches manage own practice sets" ON "public"."practice_exercise_sets" USING ("public"."fn_practice_set_coach_access"("practice_exercise_sets".*)) WITH CHECK ("public"."fn_practice_set_coach_access"("practice_exercise_sets".*));



CREATE POLICY "Enrolled users can view lesson content" ON "public"."lesson_content" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ((("public"."lessons"
     JOIN "public"."course_modules" ON (("course_modules"."id" = "lessons"."module_id")))
     JOIN "public"."courses" ON (("courses"."id" = "course_modules"."course_id")))
     JOIN "public"."course_enrollments" ON (("course_enrollments"."course_id" = "courses"."id")))
  WHERE (("lessons"."id" = "lesson_content"."lesson_id") AND ("course_enrollments"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."lessons"
     JOIN "public"."course_modules" ON (("course_modules"."id" = "lessons"."module_id")))
     JOIN "public"."courses" ON (("courses"."id" = "course_modules"."course_id")))
  WHERE (("lessons"."id" = "lesson_content"."lesson_id") AND ("courses"."status" = 'published'::"public"."course_status"))))));



CREATE POLICY "Enrolled users can view lessons" ON "public"."lessons" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (("public"."course_modules"
     JOIN "public"."courses" ON (("courses"."id" = "course_modules"."course_id")))
     JOIN "public"."course_enrollments" ON (("course_enrollments"."course_id" = "courses"."id")))
  WHERE (("course_modules"."id" = "lessons"."module_id") AND ("course_enrollments"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."course_modules"
     JOIN "public"."courses" ON (("courses"."id" = "course_modules"."course_id")))
  WHERE (("course_modules"."id" = "lessons"."module_id") AND ("courses"."status" = 'published'::"public"."course_status"))))));



CREATE POLICY "Enrolled users can view modules" ON "public"."course_modules" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."course_enrollments"
  WHERE (("course_enrollments"."course_id" = "course_modules"."course_id") AND ("course_enrollments"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "course_modules"."course_id") AND ("courses"."status" = 'published'::"public"."course_status"))))));



CREATE POLICY "Everyone can view active tiers" ON "public"."tiers" FOR SELECT USING ((("is_active" = true) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Only admins can manage tiers" ON "public"."tiers" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Only admins can view security audit logs" ON "public"."security_audit_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Students view approved practice items" ON "public"."practice_exercise_items" FOR SELECT USING ("public"."fn_practice_item_student_access"("practice_exercise_items".*));



CREATE POLICY "Students view approved practice sets" ON "public"."practice_exercise_sets" FOR SELECT USING ("public"."fn_practice_set_student_access"("practice_exercise_sets".*));



CREATE POLICY "System can insert audit logs" ON "public"."security_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert completion attempts" ON "public"."lesson_completion_attempts" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert subscription audit logs" ON "public"."subscription_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can manage invoices" ON "public"."invoices" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "System can manage webhook logs" ON "public"."webhook_processing_log" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "System can update transactions" ON "public"."transactions" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Users can create their own notes" ON "public"."client_notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own meetings" ON "public"."meetings" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can delete their own notes" ON "public"."client_notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own recommendations" ON "public"."recommended_courses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can enroll in courses" ON "public"."course_enrollments" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own analytics events" ON "public"."meeting_analytics" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own wallet" ON "public"."credit_wallets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can send messages to meetings they're in" ON "public"."meeting_chat" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_chat"."meeting_id") AND (("m"."user_id" = "auth"."uid"()) OR (("auth"."uid"())::"text" IN ( SELECT "jsonb_array_elements_text"("m"."attendees") AS "jsonb_array_elements_text"))))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own credit balance" ON "public"."credit_wallets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own enrollments" ON "public"."course_enrollments" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can update their own meetings" ON "public"."meetings" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can update their own notes" ON "public"."client_notes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own wallet" ON "public"."credit_wallets" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view chat for meetings they're in" ON "public"."meeting_chat" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_chat"."meeting_id") AND (("m"."user_id" = "auth"."uid"()) OR (("auth"."uid"())::"text" IN ( SELECT "jsonb_array_elements_text"("m"."attendees") AS "jsonb_array_elements_text")))))));



CREATE POLICY "Users can view meetings they host or attend" ON "public"."meetings" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("auth"."uid"())::"text" IN ( SELECT "jsonb_array_elements_text"("meetings"."attendees") AS "jsonb_array_elements_text")) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can view own profile securely" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own completion attempts" ON "public"."lesson_completion_attempts" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own credit balance" ON "public"."credit_wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own enrollments" ON "public"."course_enrollments" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can view their own invoices" ON "public"."invoices" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can view their own notes" ON "public"."client_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own recommendations" ON "public"."recommended_courses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."credit_transactions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own transactions" ON "public"."transactions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can view their own wallet" ON "public"."credit_wallets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users view own role only" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_generations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_generations_insert_service" ON "public"."ai_generations" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "ai_generations_select_self" ON "public"."ai_generations" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."client_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_notes_delete_owner" ON "public"."client_notes" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "client_notes_insert_owner" ON "public"."client_notes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "client_notes_select_owner" ON "public"."client_notes" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "client_notes_update_owner" ON "public"."client_notes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."coach_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_delete_v2" ON "public"."content_interactions" FOR DELETE USING (true);



CREATE POLICY "content_insert_v2" ON "public"."content_interactions" FOR INSERT WITH CHECK (("user_id" IS NOT NULL));



ALTER TABLE "public"."content_interactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_select_v2" ON "public"."content_interactions" FOR SELECT USING (true);



CREATE POLICY "content_update_v2" ON "public"."content_interactions" FOR UPDATE USING (true) WITH CHECK (("user_id" IS NOT NULL));



ALTER TABLE "public"."course_content_embeddings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_content_embeddings_delete_service" ON "public"."course_content_embeddings" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "course_content_embeddings_insert_service" ON "public"."course_content_embeddings" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "course_content_embeddings_select_all" ON "public"."course_content_embeddings" FOR SELECT USING (true);



CREATE POLICY "course_content_embeddings_update_service" ON "public"."course_content_embeddings" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."course_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lesson_completion_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lesson_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lesson_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_chat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_exercise_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_exercise_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "progress_delete_v2" ON "public"."lesson_progress" FOR DELETE USING (true);



CREATE POLICY "progress_insert_v2" ON "public"."lesson_progress" FOR INSERT WITH CHECK (("user_id" IS NOT NULL));



CREATE POLICY "progress_select_v2" ON "public"."lesson_progress" FOR SELECT USING (true);



CREATE POLICY "progress_update_v2" ON "public"."lesson_progress" FOR UPDATE USING (true) WITH CHECK (("user_id" IS NOT NULL));



ALTER TABLE "public"."recommended_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_role_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_processing_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."withdrawal_requests" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_course_progress"("_user_id" "uuid", "_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_course_progress"("_user_id" "uuid", "_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_course_progress"("_user_id" "uuid", "_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_renewal_date"("_billing_cycle" "text", "_start_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_renewal_date"("_billing_cycle" "text", "_start_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_renewal_date"("_billing_cycle" "text", "_start_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_duplicate_subscription"("_user_id" "uuid", "_coach_id" "uuid", "_package_id" "uuid", "_tier_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_duplicate_subscription"("_user_id" "uuid", "_coach_id" "uuid", "_package_id" "uuid", "_tier_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_duplicate_subscription"("_user_id" "uuid", "_coach_id" "uuid", "_package_id" "uuid", "_tier_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_recommendations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_recommendations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_recommendations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "service_role";



GRANT ALL ON TABLE "public"."practice_exercise_items" TO "anon";
GRANT ALL ON TABLE "public"."practice_exercise_items" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_exercise_items" TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_practice_item_coach_access"("item" "public"."practice_exercise_items") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_practice_item_coach_access"("item" "public"."practice_exercise_items") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_practice_item_coach_access"("item" "public"."practice_exercise_items") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_practice_item_student_access"("item" "public"."practice_exercise_items") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_practice_item_student_access"("item" "public"."practice_exercise_items") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_practice_item_student_access"("item" "public"."practice_exercise_items") TO "service_role";



GRANT ALL ON TABLE "public"."practice_exercise_sets" TO "anon";
GRANT ALL ON TABLE "public"."practice_exercise_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_exercise_sets" TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_practice_set_coach_access"("pes" "public"."practice_exercise_sets") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_practice_set_coach_access"("pes" "public"."practice_exercise_sets") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_practice_set_coach_access"("pes" "public"."practice_exercise_sets") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_practice_set_student_access"("pes" "public"."practice_exercise_sets") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_practice_set_student_access"("pes" "public"."practice_exercise_sets") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_practice_set_student_access"("pes" "public"."practice_exercise_sets") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_aged_credits"("p_user_id" "uuid", "p_min_age_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_aged_credits"("p_user_id" "uuid", "p_min_age_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_aged_credits"("p_user_id" "uuid", "p_min_age_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_withdrawable_credits"("user_id_param" "uuid", "credit_aging_days_param" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_withdrawable_credits"("user_id_param" "uuid", "credit_aging_days_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_withdrawable_credits"("user_id_param" "uuid", "credit_aging_days_param" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coach_paychangu_secret"("_coach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_paychangu_secret"("_coach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coach_paychangu_secret"("_coach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_lesson"("_user_id" "uuid", "_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_lesson"("_user_id" "uuid", "_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_lesson"("_user_id" "uuid", "_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_credit_wallet"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_credit_wallet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_credit_wallet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_subscription_expiring_soon"("_subscription_id" "uuid", "_days_ahead" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_subscription_expiring_soon"("_subscription_id" "uuid", "_days_ahead" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_subscription_expiring_soon"("_subscription_id" "uuid", "_days_ahead" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_role_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_role_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_role_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_subscription_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_subscription_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_subscription_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_withdrawal"("coach_id" "uuid", "credits_amount" integer, "amount_mwk" integer, "withdrawal_id" "uuid", "payout_ref" "text", "payout_trans_id" "text", "payment_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_withdrawal"("coach_id" "uuid", "credits_amount" integer, "amount_mwk" integer, "withdrawal_id" "uuid", "payout_ref" "text", "payout_trans_id" "text", "payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_withdrawal"("coach_id" "uuid", "credits_amount" integer, "amount_mwk" integer, "withdrawal_id" "uuid", "payout_ref" "text", "payout_trans_id" "text", "payment_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_failed_withdrawal"("coach_id" "uuid", "credits_amount" integer, "withdrawal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_failed_withdrawal"("coach_id" "uuid", "credits_amount" integer, "withdrawal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_failed_withdrawal"("coach_id" "uuid", "credits_amount" integer, "withdrawal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_credits"("from_user_id" "uuid", "to_user_id" "uuid", "amount" numeric, "transaction_type" character varying, "reference_type" character varying, "reference_id" "uuid", "description" "text", "metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_credits"("from_user_id" "uuid", "to_user_id" "uuid", "amount" numeric, "transaction_type" character varying, "reference_type" character varying, "reference_id" "uuid", "description" "text", "metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_credits"("from_user_id" "uuid", "to_user_id" "uuid", "amount" numeric, "transaction_type" character varying, "reference_type" character varying, "reference_id" "uuid", "description" "text", "metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_own_role"("p_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_own_role"("p_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_own_role"("p_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_subscription_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_subscription_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_subscription_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_transaction_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_transaction_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_transaction_status_transition"() TO "service_role";



GRANT ALL ON TABLE "public"."ai_generations" TO "anon";
GRANT ALL ON TABLE "public"."ai_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generations" TO "service_role";



GRANT ALL ON TABLE "public"."client_notes" TO "anon";
GRANT ALL ON TABLE "public"."client_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notes" TO "service_role";



GRANT ALL ON TABLE "public"."coach_settings" TO "anon";
GRANT ALL ON TABLE "public"."coach_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_settings" TO "service_role";



GRANT ALL ON TABLE "public"."coach_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."coach_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."content_interactions" TO "anon";
GRANT ALL ON TABLE "public"."content_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."content_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."course_content_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."course_content_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."course_content_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."course_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."course_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."course_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."course_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."course_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."course_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."course_modules" TO "anon";
GRANT ALL ON TABLE "public"."course_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."course_modules" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."credit_packages" TO "anon";
GRANT ALL ON TABLE "public"."credit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."credit_wallets" TO "anon";
GRANT ALL ON TABLE "public"."credit_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_wallets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_sequence" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_sequence" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_sequence" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_completion_attempts" TO "anon";
GRANT ALL ON TABLE "public"."lesson_completion_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_completion_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_content" TO "anon";
GRANT ALL ON TABLE "public"."lesson_content" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_content" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_progress" TO "anon";
GRANT ALL ON TABLE "public"."lesson_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_progress" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_analytics" TO "anon";
GRANT ALL ON TABLE "public"."meeting_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_chat" TO "anon";
GRANT ALL ON TABLE "public"."meeting_chat" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_chat" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recommended_courses" TO "anon";
GRANT ALL ON TABLE "public"."recommended_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."recommended_courses" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."subscription_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."tiers" TO "anon";
GRANT ALL ON TABLE "public"."tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."tiers" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_role_changes" TO "anon";
GRANT ALL ON TABLE "public"."user_role_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role_changes" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."v_practice_exercise_coach_scope" TO "anon";
GRANT ALL ON TABLE "public"."v_practice_exercise_coach_scope" TO "authenticated";
GRANT ALL ON TABLE "public"."v_practice_exercise_coach_scope" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_processing_log" TO "anon";
GRANT ALL ON TABLE "public"."webhook_processing_log" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_processing_log" TO "service_role";



GRANT ALL ON TABLE "public"."withdrawal_requests" TO "anon";
GRANT ALL ON TABLE "public"."withdrawal_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."withdrawal_requests" TO "service_role";



GRANT ALL ON TABLE "public"."withdrawal_analytics" TO "anon";
GRANT ALL ON TABLE "public"."withdrawal_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."withdrawal_analytics" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
