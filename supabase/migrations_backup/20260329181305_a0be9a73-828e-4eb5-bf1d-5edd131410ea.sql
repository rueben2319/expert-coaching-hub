
-- Fix search_path for all 11 user-created functions

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_files()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_certificate_id()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN 'CERT-' || upper(substring(encode(gen_random_bytes(16), 'hex'), 1, 12));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_file_signed_url_placeholder(file_path text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN 'https://placeholder-url-for-' || file_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_file_download(file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  UPDATE course_files 
  SET download_count = download_count + 1 
  WHERE id = file_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.issue_course_certificate(p_user_id uuid, p_course_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  certificate_uuid UUID;
  certificate_id_text TEXT;
  coach_name TEXT;
  course_title TEXT;
  completion_date TEXT;
BEGIN
  SELECT id INTO certificate_uuid
  FROM course_certificates
  WHERE user_id = p_user_id AND course_id = p_course_id;
  
  IF certificate_uuid IS NOT NULL THEN
    RETURN certificate_uuid;
  END IF;
  
  SELECT c.title, p.full_name
  INTO course_title, coach_name
  FROM courses c
  JOIN profiles p ON c.coach_id = p.id
  WHERE c.id = p_course_id;
  
  certificate_id_text := generate_certificate_id();
  completion_date := to_char(now(), 'Month DD, YYYY');
  
  INSERT INTO course_certificates (course_id, user_id, certificate_id, certificate_url)
  VALUES (p_course_id, p_user_id, certificate_id_text, NULL)
  RETURNING id INTO certificate_uuid;
  
  RETURN certificate_uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_old_processing_withdrawals_as_pending()
 RETURNS TABLE(withdrawal_id uuid, old_status text, new_status text, hours_processing numeric)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  UPDATE withdrawal_requests
  SET status = 'pending'
  WHERE status = 'processing' 
    AND created_at < NOW() - INTERVAL '24 hours'
    AND transaction_ref IS NOT NULL
  RETURNING id, 'processing'::TEXT, 'pending'::TEXT,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_issue_certificate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.progress_percentage >= 100 AND NEW.status = 'completed' THEN
    PERFORM issue_course_certificate(NEW.user_id, NEW.course_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_course_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_course_rating(course_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  avg_rating DECIMAL(3,2);
  review_cnt INTEGER;
BEGIN
  SELECT COALESCE(AVG(rating), 0)::DECIMAL(3,2), COUNT(*)
  INTO avg_rating, review_cnt
  FROM course_reviews WHERE course_id = course_uuid;
  
  UPDATE courses 
  SET average_rating = avg_rating, review_count = review_cnt, updated_at = now()
  WHERE id = course_uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_certificate(p_certificate_id text)
 RETURNS TABLE(certificate_id text, course_title text, student_name text, coach_name text, issued_at timestamp with time zone, expires_at timestamp with time zone, verification_status text, is_valid boolean)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    cv.certificate_id, cv.course_title, cv.student_name, cv.coach_name,
    cv.issued_at, cv.expires_at, cv.verification_status,
    (cv.verification_status = 'valid' AND (cv.expires_at IS NULL OR cv.expires_at > now()))::BOOLEAN as is_valid
  FROM certificate_verification cv
  WHERE cv.certificate_id = p_certificate_id;
END;
$function$;
