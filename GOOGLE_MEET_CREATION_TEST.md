# Google Meet Creation Test Flow

## Current Status
🚨 **Google Cloud Project Deleted** - Google Meet creation will fail until fixed

## Test Scenario: Schedule New Session

### Step 1: Navigate to Create Session
1. Go to Sessions page (`/coach/sessions`)
2. Click **"Schedule New Session"** button
3. This navigates to `/coach/sessions/create`

**✅ ROUTE FIXED**: Added missing route `/coach/sessions/create` to App.tsx

### Step 2: Expected UI Elements
✅ **Page Elements Present:**
- Title: "Schedule New Session"
- Description: "Create a Google Meet session and send calendar invites to participants"
- GoogleCalendarStatus component (showing connection status)
- Session Details form with fields:
  - Meeting Title (required)
  - Description (optional)
  - Start Time (required)
  - End Time (required)
  - Attendee Emails (required)
  - Course (optional dropdown)

### Step 3: Current Behavior (With Deleted Project)
❌ **What Will Happen:**
1. GoogleCalendarStatus shows "Disconnected" 
2. Alert appears: "Google Calendar connection is required to create meetings"
3. If you try to submit form anyway:
   ```
   Error: Google Cloud Project has been deleted. 
   Please reconfigure OAuth credentials in Google Cloud Console and update Supabase settings.
   ```

### Step 4: Expected Behavior (After Fix)
✅ **What Should Happen:**
1. GoogleCalendarStatus shows "Connected"
2. Form submission calls `MeetingManager.createMeeting()`
3. Creates Google Calendar event with Google Meet link
4. Stores meeting in Supabase database
5. Sends calendar invites to attendees
6. Shows success message with Meet link
7. Redirects to success page

## Test Data for Form
```json
{
  "summary": "Test Coaching Session",
  "description": "Testing Google Meet integration",
  "startTime": "2025-01-15T14:00:00",
  "endTime": "2025-01-15T15:00:00", 
  "attendees": "test@example.com, student@example.com",
  "courseId": "" // Optional
}
```

## API Call Flow
1. **Frontend**: `MeetingManager.createMeeting()` called
2. **Calendar API**: Creates event with Google Meet link
3. **Database**: Stores meeting record in Supabase
4. **Analytics**: Logs meeting creation event
5. **Response**: Returns meeting object with `meet_link`

## Error Scenarios to Test

### 1. No Google Calendar Connection
- **Expected**: Form disabled with connection warning
- **Current**: Shows connection error

### 2. Invalid Email Addresses
- **Expected**: Validation error before API call
- **Test**: Try "invalid-email" in attendees field

### 3. Invalid Date Range
- **Expected**: Validation error "End time must be after start time"
- **Test**: Set end time before start time

### 4. Google API Failure (Current Issue)
- **Expected**: Clear error message about project deletion
- **Current**: "Google Cloud Project has been deleted" error

## Success Indicators
✅ **Meeting Created Successfully:**
- Google Calendar event created
- Google Meet link generated
- Database record stored
- Calendar invites sent
- Success page displayed with meeting details

## Debug Commands
Use these in browser console after navigating to create session page:

```javascript
// Check token status
window.tokenDebug.logStatus();

// Get detailed token info
window.tokenDebug.getInfo().then(console.log);

// Test calendar access (will fail until fixed)
window.tokenDebug.testAccess();
```

## Next Steps
1. **Fix Google Cloud Project** (follow URGENT_GOOGLE_SETUP_FIX.md)
2. **Test form submission** with valid data
3. **Verify Google Meet link generation**
4. **Check calendar invite delivery**
5. **Confirm database storage**
