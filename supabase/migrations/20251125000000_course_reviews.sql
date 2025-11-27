-- Create course reviews table
CREATE TABLE IF NOT EXISTS course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, user_id)
);

-- Add indexes for performance
CREATE INDEX idx_course_reviews_course_id ON course_reviews(course_id);
CREATE INDEX idx_course_reviews_user_id ON course_reviews(user_id);
CREATE INDEX idx_course_reviews_created_at ON course_reviews(created_at);

-- Add rating aggregation to courses table
ALTER TABLE courses ADD COLUMN average_rating DECIMAL(3,2);
ALTER TABLE courses ADD COLUMN review_count INTEGER DEFAULT 0;

-- Create function to update course rating
CREATE OR REPLACE FUNCTION update_course_rating(course_uuid UUID)
RETURNS void AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  review_cnt INTEGER;
BEGIN
  SELECT 
    COALESCE(AVG(rating), 0)::DECIMAL(3,2),
    COUNT(*)
  INTO avg_rating, review_cnt
  FROM course_reviews 
  WHERE course_id = course_uuid;
  
  UPDATE courses 
  SET 
    average_rating = avg_rating,
    review_count = review_cnt,
    updated_at = now()
  WHERE id = course_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update rating when review is added/updated/deleted
CREATE OR REPLACE FUNCTION trigger_update_course_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_course_rating(OLD.course_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_course_rating(NEW.course_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER course_review_insert_trigger
  AFTER INSERT ON course_reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_update_course_rating();

CREATE TRIGGER course_review_update_trigger
  AFTER UPDATE ON course_reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_update_course_rating();

CREATE TRIGGER course_review_delete_trigger
  AFTER DELETE ON course_reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_update_course_rating();

-- RLS Policies
ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;

-- Users can view reviews for courses they're enrolled in or published courses
CREATE POLICY "Users can view course reviews" ON course_reviews FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM course_enrollments ce 
    WHERE ce.course_id = course_reviews.course_id 
    AND ce.user_id = auth.uid()
  ) OR (
    EXISTS (
      SELECT 1 FROM courses c 
      WHERE c.id = course_reviews.course_id 
      AND c.status = 'published'
    )
  )
);

-- Only enrolled users can create reviews
CREATE POLICY "Enrolled users can create reviews" ON course_reviews FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM course_enrollments ce 
    WHERE ce.course_id = course_reviews.course_id 
    AND ce.user_id = auth.uid()
  )
);

-- Users can only update their own reviews
CREATE POLICY "Users can update own reviews" ON course_reviews FOR UPDATE USING (
  user_id = auth.uid()
);

-- Users can only delete their own reviews
CREATE POLICY "Users can delete own reviews" ON course_reviews FOR DELETE USING (
  user_id = auth.uid()
);

-- Grant permissions
GRANT ALL ON course_reviews TO authenticated;
GRANT SELECT ON course_reviews TO anon;
