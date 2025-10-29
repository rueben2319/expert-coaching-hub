-- Add lesson completion logging for debugging and audit trail
-- This helps track why lessons complete or fail to complete

CREATE TABLE IF NOT EXISTS lesson_completion_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  success BOOLEAN NOT NULL,
  required_count INTEGER NOT NULL,
  completed_count INTEGER NOT NULL,
  details JSONB DEFAULT '{}',
  CONSTRAINT fk_lesson_completion_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_completion_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE lesson_completion_attempts ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_completion_user_id ON lesson_completion_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_lesson_id ON lesson_completion_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_attempted_at ON lesson_completion_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_success ON lesson_completion_attempts(success);

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lesson_completion_attempts' AND policyname = 'Users can view their own completion attempts') THEN
    CREATE POLICY "Users can view their own completion attempts"
    ON lesson_completion_attempts
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lesson_completion_attempts' AND policyname = 'System can insert completion attempts') THEN
    CREATE POLICY "System can insert completion attempts"
    ON lesson_completion_attempts
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON lesson_completion_attempts TO authenticated;
GRANT INSERT ON lesson_completion_attempts TO authenticated;
GRANT ALL ON lesson_completion_attempts TO service_role;

-- Update the mark_lesson_complete function to include logging
CREATE OR REPLACE FUNCTION mark_lesson_complete(_user_id UUID, _lesson_id UUID) 
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Count required content items
  SELECT COUNT(*) INTO required_content_count
  FROM lesson_content
  WHERE lesson_id = _lesson_id AND is_required = true;

  -- Count completed required content items
  SELECT COUNT(*) INTO completed_content_count
  FROM lesson_content lc
  JOIN content_interactions ci ON ci.content_id = lc.id
  WHERE lc.lesson_id = _lesson_id
    AND lc.is_required = true
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
      'timestamp', now()
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

-- Add comment
COMMENT ON TABLE lesson_completion_attempts IS 'Audit log of lesson completion attempts for debugging';
COMMENT ON FUNCTION mark_lesson_complete IS 'Marks a lesson as complete if all required content is done, with logging';
