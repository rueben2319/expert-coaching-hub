-- Add meeting as a new content type for lesson content
-- This allows coaches to create scheduled meetings as lesson content

-- Add meeting to the content_type enum
ALTER TYPE "public"."content_type" ADD VALUE 'meeting';

-- Add comment for documentation
COMMENT ON TYPE "public"."content_type" IS 'Content types for lesson content: video, text, quiz, interactive, file, meeting';
