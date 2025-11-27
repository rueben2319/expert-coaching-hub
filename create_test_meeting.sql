-- Insert a test meeting for the client fandikaienterprises@gmail.com
-- First, we need a coach user to create the meeting

-- Find a coach user (you'll need to replace with actual coach ID)
SELECT id, email FROM profiles WHERE id IN (
  SELECT user_id FROM user_roles WHERE role = 'coach'
) LIMIT 5;

-- Once you have a coach ID, run this (replace COACH_ID_HERE):
INSERT INTO meetings (
  id,
  user_id,
  summary,
  description,
  start_time,
  end_time,
  attendees,
  status,
  meet_link,
  calendar_event_id,
  created_at
) VALUES (
  gen_random_uuid(),
  'COACH_ID_HERE', -- Replace with actual coach ID
  'Test Coaching Session',
  'This is a test session to verify client can see invitations',
  NOW() + INTERVAL '1 hour',
  NOW() + INTERVAL '2 hours',
  ARRAY['fandikaienterprises@gmail.com', 'coach@example.com'],
  'scheduled',
  'https://meet.google.com/test-meeting-link',
  'test-calendar-event-id',
  NOW()
);

-- Verify the meeting was created
SELECT * FROM meetings WHERE attendees @> ARRAY['fandikaienterprises@gmail.com'];
