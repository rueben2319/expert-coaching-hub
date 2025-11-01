# 🎬 Video Completion Debugging Guide

## Current Issue
Video completion is not being recorded properly. The fallback tracking is running (indicating YouTube events aren't firing), and there's a 409 conflict error on lesson_progress.

## What We Fixed
1. ✅ Added comprehensive logging throughout the video completion flow
2. ✅ Added explicit `onConflict` parameter to upsert operations
3. ✅ Added duplicate completion check in `handleVideoComplete`
4. ✅ Added detailed state logging for debugging

## Testing Steps

### 1. Open Browser Console
Press F12 to open DevTools and go to the Console tab.

### 2. Watch a Video
Navigate to a lesson with video content and start watching.

### 3. Monitor Console Logs

You should see these logs in sequence:

#### **When Video Starts:**
```
YouTube state change: 1
YouTube: Playing
```

#### **Every 10 Seconds (Progress Saves):**
```
💾 Saving progress: {
  percentage: "45.2",
  isComplete: false,
  watchTime: "135.6",
  estimatedDuration: 300,
  contentId: "..."
}
✅ Progress saved: [...]
```

#### **Every 30 Seconds (Fallback - Should NOT appear if YouTube events work):**
```
Fallback tracking: +30s
```
**⚠️ If you see this, YouTube postMessage events are NOT working!**

#### **When Video Reaches 90% or Ends:**
```
🎬 handleVideoComplete called
Current state: { isCompleted: false, watchTime: 270, user: true, contentId: "..." }
💾 Saving progress with completion...
💾 Saving progress: {
  percentage: "100.0",
  isComplete: true,
  watchTime: "270.0",
  estimatedDuration: 300,
  contentId: "..."
}
✅ Progress saved: [...]
📢 Calling onComplete callback
✅ Video completion saved
```

#### **Lesson Auto-Completion Check:**
```
Checking lesson completion: {
  lessonId: "...",
  totalContent: 3,
  requiredContent: 3,
  interactions: 3
}
Content xxx (Title): completed
Content yyy (Title): completed
Content zzz (Title): completed
🚀 Calling mark_lesson_complete RPC: {
  userId: "...",
  lessonId: "...",
  requiredCount: 3,
  completedCount: 3
}
✅ Lesson marked complete successfully!
```

#### **Success Toast:**
```
🎉 Lesson completed!
Great progress! Keep it up!
```

## Common Issues & Solutions

### Issue 1: "Fallback tracking: +30s" Appears
**Problem:** YouTube postMessage events not firing  
**Cause:** YouTube iframe API communication failure  
**Impact:** Watch time is estimated (30s increments) instead of precise

**Solutions:**
1. Check if YouTube URL has `?enablejsapi=1` parameter
2. Verify iframe origin matches window.location.origin
3. Check browser console for CORS errors
4. Try refreshing the page

### Issue 2: 409 Conflict on lesson_progress
**Problem:** Trying to INSERT when record exists  
**Status:** ✅ FIXED - Now using upsert with onConflict

**What we did:**
- Changed `.insert()` to `.upsert()` with `onConflict: 'user_id,lesson_id'`
- The RPC function `mark_lesson_complete` already uses `ON CONFLICT ... DO UPDATE`

### Issue 3: "⚠️ Already completed, skipping"
**Problem:** `handleVideoComplete` called multiple times  
**Status:** ✅ FIXED - Added duplicate check

**What we did:**
- Check `isCompleted` state before proceeding
- Early return if already completed
- Prevents duplicate database writes

### Issue 4: Content not marked as completed
**Problem:** `is_completed` stays false in database  
**Check:**
1. Look for "💾 Saving progress" with `isComplete: true`
2. Check for "✅ Progress saved" confirmation
3. Verify no error messages

**Possible causes:**
- RLS policies blocking write
- User not authenticated
- contentId mismatch

## Database Queries for Debugging

### Check Content Interactions
```sql
SELECT 
  ci.id,
  ci.user_id,
  ci.content_id,
  ci.is_completed,
  ci.interaction_data->>'watch_time' as watch_time,
  ci.interaction_data->>'last_position' as last_position,
  lc.title as content_title
FROM content_interactions ci
JOIN lesson_content lc ON lc.id = ci.content_id
WHERE ci.user_id = 'YOUR_USER_ID'
ORDER BY ci.updated_at DESC
LIMIT 10;
```

### Check Lesson Progress
```sql
SELECT 
  lp.id,
  lp.user_id,
  lp.lesson_id,
  lp.is_completed,
  lp.started_at,
  lp.completed_at,
  l.title as lesson_title
FROM lesson_progress lp
JOIN lessons l ON l.id = lp.lesson_id
WHERE lp.user_id = 'YOUR_USER_ID'
ORDER BY lp.updated_at DESC
LIMIT 10;
```

### Check Lesson Completion Attempts (Debug Table)
```sql
SELECT *
FROM lesson_completion_attempts
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

This shows:
- How many times completion was attempted
- Required vs completed content counts
- Success/failure status

## Expected Flow Diagram

```
User watches video (90%+)
    ↓
handleVideoComplete() called
    ↓
Check if already completed → YES → Skip
    ↓ NO
setIsCompleted(true)
    ↓
saveProgress(100, true)
    ↓
Upsert to content_interactions
    ↓
onComplete() callback
    ↓
CourseViewer: checkAndCompleteLesson()
    ↓
Check all required content completed
    ↓
Call mark_lesson_complete RPC
    ↓
RPC: Count required vs completed
    ↓
RPC: Upsert lesson_progress
    ↓
Return true
    ↓
Show "🎉 Lesson completed!" toast
    ↓
Invalidate queries → UI updates
```

## Next Steps

1. **Test with the new logging** - Watch a video and monitor console
2. **Share console output** - Copy all logs from video start to completion
3. **Check database** - Run the SQL queries above to verify data
4. **Report findings** - Let me know what you see in the logs

## Files Modified
- `src/components/content/VideoContent.tsx` - Added comprehensive logging
- `src/pages/client/CourseViewer.tsx` - Added detailed completion logging
- Both files now use explicit `onConflict` in upsert operations
