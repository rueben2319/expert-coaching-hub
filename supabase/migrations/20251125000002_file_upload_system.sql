-- Add file storage support for course content
-- This migration adds support for file uploads to Supabase Storage

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-content',
  'course-content',
  false, -- Private bucket, access via signed URLs
  104857600, -- 100MB max file size
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mp3', 'audio/wav', 'audio/ogg',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Create course files table to track uploaded files
CREATE TABLE IF NOT EXISTS course_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  is_public BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  tags TEXT[], -- For categorization
  description TEXT,
  UNIQUE(course_id, lesson_id, file_path)
);

-- Add indexes
CREATE INDEX idx_course_files_course_id ON course_files(course_id);
CREATE INDEX idx_course_files_lesson_id ON course_files(lesson_id);
CREATE INDEX idx_course_files_uploaded_by ON course_files(uploaded_by);
CREATE INDEX idx_course_files_file_type ON course_files(file_type);
CREATE INDEX idx_course_files_uploaded_at ON course_files(uploaded_at);

-- Add file_url column to lesson_content for direct file references
ALTER TABLE lesson_content ADD COLUMN file_url TEXT;
ALTER TABLE lesson_content ADD COLUMN file_metadata JSONB;

-- RLS Policies for course_files
ALTER TABLE course_files ENABLE ROW LEVEL SECURITY;

-- Users can view files for courses they're enrolled in or own
CREATE POLICY "Users can view course files" ON course_files FOR SELECT USING (
  -- Course owners can view all files
  EXISTS (
    SELECT 1 FROM courses 
    WHERE courses.id = course_files.course_id 
    AND courses.coach_id = auth.uid()
  ) OR
  -- Enrolled students can view files
  EXISTS (
    SELECT 1 FROM course_enrollments ce 
    WHERE ce.course_id = course_files.course_id 
    AND ce.user_id = auth.uid()
  )
);

-- Course owners can upload files
CREATE POLICY "Course owners can upload files" ON course_files FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM courses 
    WHERE courses.id = course_files.course_id 
    AND courses.coach_id = auth.uid()
  )
);

-- Course owners can update files
CREATE POLICY "Course owners can update files" ON course_files FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM courses 
    WHERE courses.id = course_files.course_id 
    AND courses.coach_id = auth.uid()
  )
);

-- Course owners can delete files
CREATE POLICY "Course owners can delete files" ON course_files FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM courses 
    WHERE courses.id = course_files.course_id 
    AND courses.coach_id = auth.uid()
  )
);

-- Grant permissions
GRANT ALL ON course_files TO authenticated;
GRANT SELECT ON course_files TO anon;

-- Storage policies are handled differently in Supabase
-- These policies will be created via the Supabase Dashboard or CLI
-- The RLS policies below handle database access control

-- Function to generate signed URL for file access
-- Note: This function will be implemented as an Edge Function
-- since Supabase Storage functions are not directly accessible in SQL
CREATE OR REPLACE FUNCTION get_file_signed_url_placeholder(file_path TEXT)
RETURNS TEXT AS $$
BEGIN
  -- This is a placeholder - actual implementation will be in Edge Function
  RETURN 'https://placeholder-url-for-' || file_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track file downloads
CREATE OR REPLACE FUNCTION increment_file_download(file_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE course_files 
  SET download_count = download_count + 1 
  WHERE id = file_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically clean up orphaned files
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS void AS $$
BEGIN
  -- Delete files from storage that don't have corresponding database records
  -- This would typically be called by a scheduled job
  NULL;
END;
$$ LANGUAGE plpgsql;
