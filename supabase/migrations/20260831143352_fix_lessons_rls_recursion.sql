-- Prevent lessons RLS policies from querying the lessons table recursively.

DROP POLICY IF EXISTS "View lessons of published courses" ON public.lessons;
DROP POLICY IF EXISTS "Coaches can view own lessons" ON public.lessons;
DROP POLICY IF EXISTS "Enrolled users can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Coaches can manage own lessons" ON public.lessons;

CREATE POLICY "View lessons of published courses" ON public.lessons
	FOR SELECT USING (
		EXISTS (
			SELECT 1
			FROM public.course_modules cm
			JOIN public.courses c ON c.id = cm.course_id
			WHERE cm.id = lessons.module_id
				AND c.status = 'published'
		)
	);

CREATE POLICY "Coaches can view own lessons" ON public.lessons
	FOR SELECT USING (
		EXISTS (
			SELECT 1
			FROM public.course_modules cm
			JOIN public.courses c ON c.id = cm.course_id
			WHERE cm.id = lessons.module_id
				AND c.coach_id = auth.uid()
		)
	);

CREATE POLICY "Enrolled users can view lessons" ON public.lessons
	FOR SELECT USING (
		EXISTS (
			SELECT 1
			FROM public.course_modules cm
			JOIN public.courses c ON c.id = cm.course_id
			WHERE cm.id = lessons.module_id
				AND public.is_enrolled(c.id)
		)
	);

CREATE POLICY "Coaches can manage own lessons" ON public.lessons
	FOR ALL USING (
		EXISTS (
			SELECT 1
			FROM public.course_modules cm
			JOIN public.courses c ON c.id = cm.course_id
			WHERE cm.id = lessons.module_id
				AND c.coach_id = auth.uid()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1
			FROM public.course_modules cm
			JOIN public.courses c ON c.id = cm.course_id
			WHERE cm.id = lessons.module_id
				AND c.coach_id = auth.uid()
		)
	);
