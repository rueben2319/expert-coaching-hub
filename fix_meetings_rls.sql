-- Fix the meetings RLS policy to check user email instead of UUID
-- The current policy incorrectly compares auth.uid() (UUID) with email addresses

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can view meetings they host or attend" ON "public"."meetings";

-- Create corrected policy that checks user email from profiles
CREATE POLICY "Users can view meetings they host or attend" ON "public"."meetings" 
FOR SELECT USING (
  ("user_id" = auth.uid()) OR 
  (has_role(auth.uid(), 'admin')) OR
  (EXISTS (
    SELECT 1 
    FROM "public"."profiles" p 
    WHERE p.id = auth.uid() 
    AND p.email::text IN (SELECT jsonb_array_elements_text("meetings"."attendees"))
  ))
);

-- Also fix the chat policies that have the same issue
DROP POLICY IF EXISTS "Users can send messages to meetings they're in" ON "public"."meeting_chat";

CREATE POLICY "Users can send messages to meetings they're in" ON "public"."meeting_chat" 
FOR INSERT WITH CHECK (
  ("user_id" = auth.uid()) AND 
  (EXISTS (
    SELECT 1 FROM "public"."meetings" m 
    WHERE ("m"."id" = "meeting_chat"."meeting_id") AND 
    (("m"."user_id" = auth.uid()) OR 
     (EXISTS (
       SELECT 1 FROM "public"."profiles" p 
       WHERE p.id = auth.uid() 
       AND p.email::text IN (SELECT jsonb_array_elements_text("m"."attendees"))
     )))
  ))
);

DROP POLICY IF EXISTS "Users can view chat for meetings they're in" ON "public"."meeting_chat";

CREATE POLICY "Users can view chat for meetings they're in" ON "public"."meeting_chat" 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "public"."meetings" m 
    WHERE ("m"."id" = "meeting_chat"."meeting_id") AND 
    (("m"."user_id" = auth.uid()) OR 
     (EXISTS (
       SELECT 1 FROM "public"."profiles" p 
       WHERE p.id = auth.uid() 
       AND p.email::text IN (SELECT jsonb_array_elements_text("m"."attendees"))
     )))
  )
);
