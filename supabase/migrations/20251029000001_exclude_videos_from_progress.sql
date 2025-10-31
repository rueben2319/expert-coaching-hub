-- Update mark_lesson_complete function to exclude video content from progress tracking
-- Videos are informational only - users prove they watched via quiz questions

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

COMMENT ON FUNCTION "public"."mark_lesson_complete"("_user_id" "uuid", "_lesson_id" "uuid") IS 'Marks a lesson as complete if all required NON-VIDEO content is done. Videos are informational - users prove comprehension via quiz.';
