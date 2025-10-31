-- Course Recommendation System with Vector Embeddings

-- Create table for storing course embeddings
CREATE TABLE IF NOT EXISTS public.course_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content_text TEXT NOT NULL, -- Combined title, description, objectives for embedding
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id)
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_course_embeddings_vector ON public.course_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for course_id lookups
CREATE INDEX IF NOT EXISTS idx_course_embeddings_course_id ON public.course_embeddings(course_id);

-- Enable RLS
ALTER TABLE public.course_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone can read embeddings for published courses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_embeddings' AND policyname = 'Anyone can view embeddings for published courses'
  ) THEN
    CREATE POLICY "Anyone can view embeddings for published courses"
      ON public.course_embeddings
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.courses
          WHERE courses.id = course_embeddings.course_id
            AND courses.status = 'published'
        )
      );
  END IF;
END $$;

-- Only system/coaches can insert/update embeddings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_embeddings' AND policyname = 'Coaches can manage embeddings for their courses'
  ) THEN
    CREATE POLICY "Coaches can manage embeddings for their courses"
      ON public.course_embeddings
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.courses
          WHERE courses.id = course_embeddings.course_id
            AND courses.coach_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_embeddings_updated_at'
  ) THEN
    CREATE TRIGGER update_course_embeddings_updated_at
      BEFORE UPDATE ON public.course_embeddings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create table for caching recommendations
CREATE TABLE IF NOT EXISTS public.recommended_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommended_course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  source_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  similarity_score FLOAT,
  reason TEXT, -- Why this was recommended
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days') -- Cache for 7 days
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recommended_courses_user_id ON public.recommended_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_recommended_courses_expires_at ON public.recommended_courses(expires_at);

-- Enable RLS
ALTER TABLE public.recommended_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own recommendations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recommended_courses' AND policyname = 'Users can view their own recommendations'
  ) THEN
    CREATE POLICY "Users can view their own recommendations"
      ON public.recommended_courses
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recommended_courses' AND policyname = 'Users can delete their own recommendations'
  ) THEN
    CREATE POLICY "Users can delete their own recommendations"
      ON public.recommended_courses
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to clean up expired recommendations
CREATE OR REPLACE FUNCTION cleanup_expired_recommendations()
RETURNS void AS $$
BEGIN
  DELETE FROM public.recommended_courses
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE public.course_embeddings IS 'Stores vector embeddings for semantic course search';
COMMENT ON TABLE public.recommended_courses IS 'Caches course recommendations for users';
