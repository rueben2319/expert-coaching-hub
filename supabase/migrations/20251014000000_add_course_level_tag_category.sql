-- Create course level enum
CREATE TYPE course_level AS ENUM ('introduction', 'intermediate', 'advanced');

-- Add new columns to courses table
ALTER TABLE public.courses
ADD COLUMN level course_level,
ADD COLUMN tag TEXT,
ADD COLUMN category TEXT;

-- Create indexes for better performance on filtering
CREATE INDEX idx_courses_level ON public.courses(level);
CREATE INDEX idx_courses_tag ON public.courses(tag);
CREATE INDEX idx_courses_category ON public.courses(category);

-- Update trigger for updated_at (already exists, so this is just to ensure it covers new columns)
-- The existing trigger should work for all columns
