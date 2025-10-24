-- Create content_interactions table if it doesn't exist
-- This table tracks student interactions with lesson content

CREATE TABLE IF NOT EXISTS content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES lesson_content(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE content_interactions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_interactions_user_id ON content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_id ON content_interactions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_completed ON content_interactions(is_completed);

-- Create policies
CREATE POLICY "Users can manage their own content interactions"
ON content_interactions
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_content_interactions_updated_at
  BEFORE UPDATE ON content_interactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Grant permissions
GRANT ALL ON content_interactions TO authenticated;
GRANT ALL ON content_interactions TO service_role;
