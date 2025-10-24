# Lesson Progress System - Deep Dive

## Overview
The lesson progress system tracks student completion of lessons and content within courses. It's a core feature for monitoring learning progress and enabling sequential course navigation.

---

## Database Schema

### `lesson_progress` Table
```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);
```

**Key Features:**
- **Unique constraint**: One progress record per user per lesson
- **Cascade delete**: Progress deleted when lesson is deleted
- **Timestamps**: Tracks when lesson was completed
- **Boolean flag**: Simple completed/not completed status

---

## Row Level Security (RLS)

### Policy 1: Users Manage Own Progress
```sql
CREATE POLICY "Users can manage their own progress" 
ON lesson_progress 
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
```
- Users can view/update their own progress
- Admins can manage all progress

### Policy 2: Coaches View Student Progress
```sql
CREATE POLICY "Coaches can view student progress for their courses" 
ON lesson_progress FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN course_modules ON course_modules.id = lessons.module_id
    JOIN courses ON courses.id = course_modules.course_id
    WHERE lessons.id = lesson_progress.lesson_id 
    AND courses.coach_id = auth.uid()
  )
);
```
- Coaches can view progress for students in their courses
- Read-only access for coaches

---

## Database Functions

### 1. `mark_lesson_complete()`
**Purpose**: Automatically marks lesson as complete when all required content is finished

```sql
CREATE FUNCTION mark_lesson_complete(_user_id UUID, _lesson_id UUID)
RETURNS void AS $$
DECLARE
  required_content_count INTEGER;
  completed_content_count INTEGER;
BEGIN
  -- Count required content
  SELECT COUNT(*) INTO required_content_count
  FROM lesson_content
  WHERE lesson_id = _lesson_id AND is_required = true;

  -- Count completed required content
  SELECT COUNT(*) INTO completed_content_count
  FROM content_interactions ci
  JOIN lesson_content lc ON lc.id = ci.content_id
  WHERE lc.lesson_id = _lesson_id 
    AND lc.is_required = true
    AND ci.user_id = _user_id 
    AND ci.is_completed = true;

  -- Mark lesson complete if all required content is done
  IF required_content_count = completed_content_count THEN
    INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at)
    VALUES (_user_id, _lesson_id, true, now())
    ON CONFLICT (user_id, lesson_id)
    DO UPDATE SET is_completed = true, completed_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Key Logic:**
1. Counts total required content items
2. Counts completed required content items
3. Only marks lesson complete when ALL required content is done
4. Uses UPSERT to handle existing records

### 2. `calculate_course_progress()`
**Purpose**: Calculates overall course completion percentage

```sql
CREATE FUNCTION calculate_course_progress(_user_id UUID, _course_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_lessons INTEGER;
  completed_lessons INTEGER;
BEGIN
  -- Count total lessons in course
  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  JOIN course_modules cm ON cm.id = l.module_id
  WHERE cm.course_id = _course_id;

  -- Count completed lessons
  SELECT COUNT(*) INTO completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON l.id = lp.lesson_id
  JOIN course_modules cm ON cm.id = l.module_id
  WHERE cm.course_id = _course_id
    AND lp.user_id = _user_id
    AND lp.is_completed = true;

  -- Return percentage
  IF total_lessons = 0 THEN
    RETURN 0;
  ELSE
    RETURN ROUND((completed_lessons::DECIMAL / total_lessons) * 100);
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 3. `get_next_lesson()`
**Purpose**: Finds the next incomplete lesson in a course

```sql
CREATE FUNCTION get_next_lesson(_user_id UUID, _course_id UUID)
RETURNS UUID AS $$
DECLARE
  next_lesson_id UUID;
BEGIN
  SELECT l.id INTO next_lesson_id
  FROM lessons l
  JOIN course_modules cm ON cm.id = l.module_id
  LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _user_id
  WHERE cm.course_id = _course_id
    AND (lp.is_completed IS NULL OR lp.is_completed = false)
  ORDER BY cm.order_index, l.order_index
  LIMIT 1;

  RETURN next_lesson_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Frontend Implementation

### Location: `src/pages/client/CourseViewer.tsx`

### 1. Fetching Lesson Progress
```typescript
const { data: lessonProgress } = useQuery({
  queryKey: ["lesson-progress", user?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", user!.id);

    if (error) throw error;
    return data;
  },
  enabled: !!user?.id,
});
```

### 2. Auto-Creating Progress Records
```typescript
useEffect(() => {
  const createLessonProgress = async () => {
    if (!user || !currentLessonId) return;

    // Check if progress record exists
    const { data: existingProgress } = await supabase
      .from("lesson_progress")
      .select("id")
      .eq("user_id", user.id)
      .eq("lesson_id", currentLessonId)
      .single();

    // Create if doesn't exist
    if (!existingProgress) {
      await supabase
        .from("lesson_progress")
        .insert({
          user_id: user.id,
          lesson_id: currentLessonId,
          is_completed: false,
        });

      queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
    }
  };

  createLessonProgress();
}, [currentLessonId, user, queryClient]);
```

**Purpose**: Creates a progress record when student opens a lesson for the first time

### 3. Auto-Completing Lessons
```typescript
useEffect(() => {
  const checkAndCompleteLesson = async () => {
    if (!currentLessonId || !currentLesson || !user) return;

    const lessonContent = currentLesson?.lesson_content || [];
    const requiredContent = lessonContent.filter((content: any) => content.is_required);

    if (requiredContent.length === 0) return;

    // Check if all required content is completed
    const allRequiredCompleted = requiredContent.every((content: any) => {
      return contentInteractions?.some(
        (interaction: any) =>
          interaction.content_id === content.id && interaction.is_completed
      );
    });

    if (allRequiredCompleted) {
      // Check if lesson is already completed
      const isLessonAlreadyCompleted = lessonProgress?.some(
        (p: any) => p.lesson_id === currentLessonId && p.is_completed
      );

      if (!isLessonAlreadyCompleted) {
        // Use database function to mark complete
        const { error } = await supabase.rpc("mark_lesson_complete", {
          _user_id: user.id,
          _lesson_id: currentLessonId,
        });

        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
          queryClient.invalidateQueries({ queryKey: ["enrollment"] });
          toast({ title: "Lesson completed!", description: "Great progress!" });
        }
      }
    }
  };

  if (contentInteractions && currentLesson) {
    checkAndCompleteLesson();
  }
}, [currentLessonId, currentLesson, contentInteractions, lessonProgress, user, queryClient]);
```

**Key Logic:**
1. Gets all required content for the lesson
2. Checks if all required content is marked as completed in `content_interactions`
3. If yes, calls `mark_lesson_complete()` database function
4. Shows success toast notification
5. Invalidates queries to refresh UI

### 4. Manual Lesson Completion
```typescript
const completeLessonMutation = useMutation({
  mutationFn: async (lessonId: string) => {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: user!.id,
        lesson_id: lessonId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
    queryClient.invalidateQueries({ queryKey: ["enrollment"] });
    toast({ title: "Lesson marked as complete!" });
  },
});
```

**Purpose**: Allows students to manually mark lessons as complete via "Mark Complete" button

### 5. Displaying Progress
```typescript
const modules = course?.course_modules
  ?.sort((a: any, b: any) => a.order_index - b.order_index)
  .map((module: any) => ({
    id: module.id,
    title: module.title,
    order_index: module.order_index,
    lessons: module.lessons
      ?.sort((a: any, b: any) => a.order_index - b.order_index)
      .map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        order_index: lesson.order_index,
        isCompleted: lessonProgress?.some(
          (p: any) => p.lesson_id === lesson.id && p.is_completed
        ) || false,
      })) || [],
  })) || [];
```

**Purpose**: Enriches lesson data with completion status for UI display

### 6. Calculating Overall Progress
```typescript
const calculateOverallProgress = () => {
  if (modules.length === 0) return 0;

  const moduleProgresses = modules.map(module => {
    const completedLessons = module.lessons.filter((l: any) => l.isCompleted).length;
    return module.lessons.length > 0
      ? (completedLessons / module.lessons.length) * 100
      : 0;
  });

  const averageProgress = moduleProgresses.reduce((sum, progress) => sum + progress, 0) / modules.length;
  return Math.round(averageProgress);
};

const overallProgress = calculateOverallProgress();
```

**Logic:**
1. Calculates completion percentage for each module
2. Averages all module percentages
3. Returns rounded overall course progress

---

## Progress Flow

### Automatic Completion Flow
```
1. Student opens lesson
   ↓
2. Progress record created (is_completed: false)
   ↓
3. Student completes content items
   ↓
4. content_interactions updated (is_completed: true)
   ↓
5. useEffect checks if all required content done
   ↓
6. Calls mark_lesson_complete() function
   ↓
7. lesson_progress updated (is_completed: true)
   ↓
8. UI refreshed, shows checkmark
   ↓
9. Overall course progress recalculated
```

### Manual Completion Flow
```
1. Student clicks "Mark Complete" button
   ↓
2. completeLessonMutation.mutate() called
   ↓
3. lesson_progress upserted (is_completed: true)
   ↓
4. UI refreshed, shows checkmark
   ↓
5. Overall course progress recalculated
```

---

## UI Indicators

### Lesson List
- ✅ **Green checkmark**: Lesson completed
- ▶️ **Play icon**: Lesson not started/incomplete

### Progress Bars
- **Module level**: Shows % of lessons completed in module
- **Course level**: Shows overall % of all lessons completed

### Course Overview
```typescript
<div className="text-2xl font-bold">
  {overallProgress}%
</div>
<Progress value={Math.max(overallProgress, 5)} className="h-3" />
```

---

## Related Tables

### `content_interactions`
Tracks completion of individual content items within lessons
```sql
CREATE TABLE content_interactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  ...
);
```

### `course_enrollments`
Stores overall course progress percentage
```sql
CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  ...
);
```

**Note**: `progress_percentage` is updated via triggers when `lesson_progress` changes

---

## Analytics Usage

### Coach Analytics (`src/pages/coach/Analytics.tsx`)
```typescript
// Fetch student progress for coach's courses
const { data: studentProgress } = useQuery({
  queryKey: ["student-progress", user?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select(`
        *,
        lessons(
          title,
          course_modules(
            course_id,
            courses(title)
          )
        )
      `)
      .eq("lessons.course_modules.courses.coach_id", user!.id);
    
    return data;
  }
});
```

### Student Dashboard (`src/pages/client/ClientDashboard.tsx`)
```typescript
// Show recently accessed courses with progress
const { data: enrollments } = useQuery({
  queryKey: ["my-enrollments", user?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("course_enrollments")
      .select(`
        *,
        courses(
          *,
          course_modules(
            lessons(
              id,
              lesson_progress(is_completed)
            )
          )
        )
      `)
      .eq("user_id", user!.id);
    
    return data;
  }
});
```

---

## Best Practices

### 1. Always Use Queries
✅ **Good**: Use React Query for caching and automatic refetching
```typescript
const { data: lessonProgress } = useQuery({
  queryKey: ["lesson-progress", user?.id],
  queryFn: fetchLessonProgress,
});
```

❌ **Bad**: Direct Supabase calls without caching
```typescript
const progress = await supabase.from("lesson_progress").select("*");
```

### 2. Invalidate Related Queries
When updating progress, invalidate all related queries:
```typescript
queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
queryClient.invalidateQueries({ queryKey: ["enrollment"] });
queryClient.invalidateQueries({ queryKey: ["course-detail"] });
```

### 3. Use Database Functions
Prefer database functions for complex logic:
```typescript
// ✅ Good: Use database function
await supabase.rpc("mark_lesson_complete", {
  _user_id: userId,
  _lesson_id: lessonId
});

// ❌ Bad: Complex logic in frontend
// Multiple queries, race conditions, etc.
```

### 4. Handle Edge Cases
- Lessons with no required content
- Already completed lessons
- Concurrent updates
- Network failures

---

## Performance Considerations

### Indexes
```sql
CREATE INDEX idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX idx_lesson_progress_completed ON lesson_progress(is_completed);
```

### Query Optimization
- Use `select("*")` sparingly
- Only fetch needed fields
- Use pagination for large datasets
- Leverage React Query caching

---

## Future Enhancements

### Potential Improvements
1. **Time tracking**: Track time spent on each lesson
2. **Attempt tracking**: Number of quiz attempts
3. **Partial progress**: Track % completion within a lesson
4. **Streak tracking**: Consecutive days of learning
5. **Certificates**: Auto-generate on course completion
6. **Progress notifications**: Email/push when milestones reached
7. **Learning paths**: Sequential course dependencies
8. **Adaptive learning**: Recommend content based on progress

---

## Troubleshooting

### Progress Not Updating
1. Check RLS policies
2. Verify user authentication
3. Check query invalidation
4. Look for console errors
5. Verify content_interactions are being created

### Progress Calculation Wrong
1. Check `calculate_course_progress()` function
2. Verify lesson order_index values
3. Check for orphaned progress records
4. Verify module relationships

### Auto-Completion Not Working
1. Check if content has `is_required: true`
2. Verify content_interactions are marked complete
3. Check useEffect dependencies
4. Look for race conditions

---

## Summary

The lesson progress system is a robust, database-driven solution that:
- ✅ Tracks completion at lesson and content level
- ✅ Auto-completes lessons when all required content is done
- ✅ Provides real-time progress updates
- ✅ Supports manual completion override
- ✅ Calculates overall course progress
- ✅ Enforces security via RLS
- ✅ Optimized with indexes and caching
- ✅ Integrates with analytics and dashboards

The system is production-ready and handles edge cases, concurrent updates, and provides a smooth user experience.
