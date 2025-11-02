-- Fix recursive RLS policies for practice exercise tables

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_exercise_sets'
      AND policyname = 'Coaches manage own practice sets'
  ) THEN
    DROP POLICY "Coaches manage own practice sets" ON public.practice_exercise_sets;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_exercise_sets'
      AND policyname = 'Students view approved practice sets'
  ) THEN
    DROP POLICY "Students view approved practice sets" ON public.practice_exercise_sets;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_exercise_items'
      AND policyname = 'Coaches manage own practice items'
  ) THEN
    DROP POLICY "Coaches manage own practice items" ON public.practice_exercise_items;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_exercise_items'
      AND policyname = 'Students view approved practice items'
  ) THEN
    DROP POLICY "Students view approved practice items" ON public.practice_exercise_items;
  END IF;
END;
$$;

-- Helper functions that encapsulate authorization logic without re-querying through RLS
CREATE OR REPLACE FUNCTION public.fn_practice_set_coach_access(pes public.practice_exercise_sets)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.fn_practice_set_student_access(pes public.practice_exercise_sets)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.fn_practice_item_coach_access(item public.practice_exercise_items)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.fn_practice_item_student_access(item public.practice_exercise_items)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.fn_practice_set_coach_access(public.practice_exercise_sets) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_practice_set_student_access(public.practice_exercise_sets) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_practice_item_coach_access(public.practice_exercise_items) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_practice_item_student_access(public.practice_exercise_items) TO authenticated, service_role;

CREATE POLICY "Coaches manage own practice sets"
  ON public.practice_exercise_sets
  FOR ALL
  USING (public.fn_practice_set_coach_access(practice_exercise_sets))
  WITH CHECK (public.fn_practice_set_coach_access(practice_exercise_sets));

CREATE POLICY "Students view approved practice sets"
  ON public.practice_exercise_sets
  FOR SELECT
  USING (public.fn_practice_set_student_access(practice_exercise_sets));

CREATE POLICY "Coaches manage own practice items"
  ON public.practice_exercise_items
  FOR ALL
  USING (public.fn_practice_item_coach_access(practice_exercise_items))
  WITH CHECK (public.fn_practice_item_coach_access(practice_exercise_items));

CREATE POLICY "Students view approved practice items"
  ON public.practice_exercise_items
  FOR SELECT
  USING (public.fn_practice_item_student_access(practice_exercise_items));
