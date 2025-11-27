-- Add invitation_accepted event type to meeting_analytics table
-- This allows clients to accept meeting invitations

-- Drop the old constraint
ALTER TABLE "public"."meeting_analytics" DROP CONSTRAINT IF EXISTS "meeting_analytics_event_type_check";

-- Add the new constraint with invitation_accepted included
ALTER TABLE "public"."meeting_analytics" 
ADD CONSTRAINT "meeting_analytics_event_type_check" 
CHECK (("event_type" = ANY (ARRAY[
  'meeting_created'::"text", 
  'meeting_joined'::"text", 
  'meeting_left'::"text", 
  'join_clicked'::"text", 
  'chat_message_sent'::"text", 
  'meeting_cancelled'::"text",
  'invitation_accepted'::"text"
])));
