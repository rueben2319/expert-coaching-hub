-- Create client_notes table for learner note-taking with AI integration
CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.lesson_content(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  ai_summary TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_notes_user_id ON public.client_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_lesson_id ON public.client_notes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_content_id ON public.client_notes(content_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON public.client_notes(created_at DESC);

-- Enable RLS
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own notes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_notes' AND policyname = 'Users can view their own notes'
  ) THEN
    CREATE POLICY "Users can view their own notes"
      ON public.client_notes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_notes' AND policyname = 'Users can create their own notes'
  ) THEN
    CREATE POLICY "Users can create their own notes"
      ON public.client_notes
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_notes' AND policyname = 'Users can update their own notes'
  ) THEN
    CREATE POLICY "Users can update their own notes"
      ON public.client_notes
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_notes' AND policyname = 'Users can delete their own notes'
  ) THEN
    CREATE POLICY "Users can delete their own notes"
      ON public.client_notes
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Coaches can view notes from their enrolled students
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_notes' AND policyname = 'Coaches can view student notes in their courses'
  ) THEN
    CREATE POLICY "Coaches can view student notes in their courses"
      ON public.client_notes
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.lessons l
          JOIN public.course_modules cm ON l.module_id = cm.id
          JOIN public.courses c ON cm.course_id = c.id
          WHERE l.id = client_notes.lesson_id
            AND c.coach_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_notes_updated_at'
  ) THEN
    CREATE TRIGGER update_client_notes_updated_at
      BEFORE UPDATE ON public.client_notes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add comment
COMMENT ON TABLE public.client_notes IS 'Stores learner notes with optional AI-generated summaries';
