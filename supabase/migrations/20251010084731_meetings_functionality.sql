-- Create meetings table
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  summary text NOT NULL,
  description text,
  meet_link text,
  calendar_event_id text UNIQUE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  attendees jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meetings
CREATE POLICY "Users can view meetings they host or attend"
ON public.meetings
FOR SELECT
USING (
  user_id = auth.uid() OR
  auth.uid()::text = ANY(SELECT jsonb_array_elements_text(attendees)) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Coaches can create meetings"
ON public.meetings
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users can update their own meetings"
ON public.meetings
FOR UPDATE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own meetings"
ON public.meetings
FOR DELETE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create meeting_chat table
CREATE TABLE public.meeting_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_chat ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_chat
CREATE POLICY "Users can view chat for meetings they're in"
ON public.meeting_chat
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_chat.meeting_id
      AND (m.user_id = auth.uid() OR auth.uid()::text = ANY(SELECT jsonb_array_elements_text(m.attendees)))
  )
);

CREATE POLICY "Users can send messages to meetings they're in"
ON public.meeting_chat
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_chat.meeting_id
      AND (m.user_id = auth.uid() OR auth.uid()::text = ANY(SELECT jsonb_array_elements_text(m.attendees)))
  )
);

-- Create meeting_analytics table
CREATE TABLE public.meeting_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('meeting_created', 'meeting_joined', 'meeting_left', 'join_clicked', 'chat_message_sent', 'meeting_cancelled')),
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_analytics
CREATE POLICY "Coaches can view analytics for their meetings"
ON public.meeting_analytics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_analytics.meeting_id AND m.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can insert their own analytics events"
ON public.meeting_analytics
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meeting_chat_meeting_id ON public.meeting_chat(meeting_id);
CREATE INDEX idx_meeting_analytics_meeting_id ON public.meeting_analytics(meeting_id);
CREATE INDEX idx_meeting_analytics_event_type ON public.meeting_analytics(event_type);

-- Enable Realtime for meeting_chat
ALTER TABLE public.meeting_chat REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_chat;

-- Create trigger for updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
