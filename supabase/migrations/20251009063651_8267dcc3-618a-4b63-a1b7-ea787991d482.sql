-- Create enums for course management
CREATE TYPE public.course_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'dropped');
CREATE TYPE public.content_type AS ENUM ('video', 'text', 'quiz', 'interactive', 'file');

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status public.course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Course modules table
CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, order_index)
);

-- Lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  estimated_duration INTEGER, -- in minutes
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_id, order_index)
);

-- Lesson content table
CREATE TABLE public.lesson_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_type public.content_type NOT NULL,
  content_data JSONB NOT NULL,
  order_index INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, order_index)
);

-- Course enrollments table
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, course_id)
);

-- Lesson progress table
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, lesson_id)
);

-- Content interactions table
CREATE TABLE public.content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES public.lesson_content(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  interaction_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courses
CREATE POLICY "Coaches can create courses"
  ON public.courses FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can view their own courses"
  ON public.courses FOR SELECT
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can update their own courses"
  ON public.courses FOR UPDATE
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can delete their own courses"
  ON public.courses FOR DELETE
  USING (coach_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view published courses"
  ON public.courses FOR SELECT
  USING (status = 'published' OR has_role(auth.uid(), 'client'));

-- RLS Policies for course_modules
CREATE POLICY "Coaches can manage their course modules"
  ON public.course_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_modules.course_id
      AND (courses.coach_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Enrolled users can view modules"
  ON public.course_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE course_enrollments.course_id = course_modules.course_id
      AND course_enrollments.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_modules.course_id
      AND courses.status = 'published'
    )
  );

-- RLS Policies for lessons
CREATE POLICY "Coaches can manage their lessons"
  ON public.lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules
      JOIN public.courses ON courses.id = course_modules.course_id
      WHERE course_modules.id = lessons.module_id
      AND (courses.coach_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Enrolled users can view lessons"
  ON public.lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules
      JOIN public.courses ON courses.id = course_modules.course_id
      JOIN public.course_enrollments ON course_enrollments.course_id = courses.id
      WHERE course_modules.id = lessons.module_id
      AND course_enrollments.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.course_modules
      JOIN public.courses ON courses.id = course_modules.course_id
      WHERE course_modules.id = lessons.module_id
      AND courses.status = 'published'
    )
  );

-- RLS Policies for lesson_content
CREATE POLICY "Coaches can manage their lesson content"
  ON public.lesson_content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.course_modules ON course_modules.id = lessons.module_id
      JOIN public.courses ON courses.id = course_modules.course_id
      WHERE lessons.id = lesson_content.lesson_id
      AND (courses.coach_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Enrolled users can view lesson content"
  ON public.lesson_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.course_modules ON course_modules.id = lessons.module_id
      JOIN public.courses ON courses.id = course_modules.course_id
      JOIN public.course_enrollments ON course_enrollments.course_id = courses.id
      WHERE lessons.id = lesson_content.lesson_id
      AND course_enrollments.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.course_modules ON course_modules.id = lessons.module_id
      JOIN public.courses ON courses.id = course_modules.course_id
      WHERE lessons.id = lesson_content.lesson_id
      AND courses.status = 'published'
    )
  );

-- RLS Policies for course_enrollments
CREATE POLICY "Users can enroll in courses"
  ON public.course_enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own enrollments"
  ON public.course_enrollments FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own enrollments"
  ON public.course_enrollments FOR UPDATE
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view enrollments for their courses"
  ON public.course_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_enrollments.course_id
      AND courses.coach_id = auth.uid()
    )
  );

-- RLS Policies for lesson_progress
CREATE POLICY "Users can manage their own progress"
  ON public.lesson_progress FOR ALL
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view student progress for their courses"
  ON public.lesson_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.course_modules ON course_modules.id = lessons.module_id
      JOIN public.courses ON courses.id = course_modules.course_id
      WHERE lessons.id = lesson_progress.lesson_id
      AND courses.coach_id = auth.uid()
    )
  );

-- RLS Policies for content_interactions
CREATE POLICY "Users can manage their own interactions"
  ON public.content_interactions FOR ALL
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view interactions for their course content"
  ON public.content_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_content
      JOIN public.lessons ON lessons.id = lesson_content.lesson_id
      JOIN public.course_modules ON course_modules.id = lessons.module_id
      JOIN public.courses ON courses.id = course_modules.course_id
      WHERE lesson_content.id = content_interactions.content_id
      AND courses.coach_id = auth.uid()
    )
  );

-- Function to calculate course progress
CREATE OR REPLACE FUNCTION public.calculate_course_progress(_user_id UUID, _course_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to get next uncompleted lesson
CREATE OR REPLACE FUNCTION public.get_next_lesson(_user_id UUID, _course_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to mark lesson as complete
CREATE OR REPLACE FUNCTION public.mark_lesson_complete(_user_id UUID, _lesson_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id UUID;
  required_content_count INTEGER;
  completed_content_count INTEGER;
BEGIN
  -- Get course_id for this lesson
  SELECT cm.course_id INTO _course_id
  FROM public.lessons l
  JOIN public.course_modules cm ON cm.id = l.module_id
  WHERE l.id = _lesson_id;

  -- Count required content items
  SELECT COUNT(*) INTO required_content_count
  FROM public.lesson_content
  WHERE lesson_id = _lesson_id AND is_required = true;

  -- Count completed required content items
  SELECT COUNT(*) INTO completed_content_count
  FROM public.lesson_content lc
  JOIN public.content_interactions ci ON ci.content_id = lc.id
  WHERE lc.lesson_id = _lesson_id
    AND lc.is_required = true
    AND ci.user_id = _user_id
    AND ci.is_completed = true;

  -- Only mark as complete if all required content is completed
  IF required_content_count = completed_content_count THEN
    INSERT INTO public.lesson_progress (user_id, lesson_id, is_completed, completed_at)
    VALUES (_user_id, _lesson_id, true, now())
    ON CONFLICT (user_id, lesson_id)
    DO UPDATE SET is_completed = true, completed_at = now();

    -- Recalculate course progress
    PERFORM public.calculate_course_progress(_user_id, _course_id);
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_lesson_content_updated_at
  BEFORE UPDATE ON public.lesson_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_content_interactions_updated_at
  BEFORE UPDATE ON public.content_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();