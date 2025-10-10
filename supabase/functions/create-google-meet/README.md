# Create Google Meet Edge Function

## Overview
Server-side Supabase Edge Function that creates Google Calendar events with Google Meet links and stores meeting data in the database.

## IDE Configuration

This function is designed to run in Deno runtime (Supabase Edge Functions), not Node.js. The following files help with IDE support:

- **`deno.json`**: Deno configuration with import maps
- **`types.d.ts`**: TypeScript declarations for Deno globals
- **`.vscode/settings.json`**: VS Code settings for Deno support

### TypeScript Errors in IDE

If you see TypeScript errors in your IDE, they are expected because:
1. This code runs in Deno, not Node.js
2. Deno uses URL imports instead of npm packages
3. Global `Deno` object is available in runtime but not in IDE

The function will work correctly when deployed to Supabase, regardless of IDE warnings.

## Endpoint
```
POST /functions/v1/create-google-meet
```

## Authentication
Requires valid Supabase JWT token in Authorization header:
```
Authorization: Bearer <supabase-jwt-token>
```

## Request Body
```typescript
{
  summary: string;           // Meeting title (required)
  description?: string;      // Meeting description (optional)
  startTime: string;         // ISO 8601 datetime (required)
  endTime: string;           // ISO 8601 datetime (required)
  attendees: string[];       // Array of email addresses (required)
  courseId?: string;         // UUID of associated course (optional)
}
```

### Example Request
```javascript
const response = await fetch('/functions/v1/create-google-meet', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    summary: "Weekly Coaching Session",
    description: "1:1 coaching session to discuss progress and goals",
    startTime: "2024-01-15T14:00:00Z",
    endTime: "2024-01-15T15:00:00Z",
    attendees: ["student@example.com", "coach@example.com"],
    courseId: "123e4567-e89b-12d3-a456-426614174000"
  })
});
```

## Response Format

### Success Response (201)
```typescript
{
  success: true;
  meetingId: string;         // Database meeting ID
  meetLink: string | null;   // Google Meet link
  calendarEventId: string;   // Google Calendar event ID
  meeting: {
    id: string;
    summary: string;
    description: string | null;
    startTime: string;
    endTime: string;
    meetLink: string | null;
    status: string;
    attendees: string[];
    courseId: string | null;
    createdAt: string;
  };
}
```

### Error Response (400)
```typescript
{
  error: string;  // Error message
}
```

## Function Responsibilities

### 1. Authentication & Validation
- ✅ Validates Supabase JWT token
- ✅ Extracts user from authentication
- ✅ Validates required request fields
- ✅ Validates date formats and logic

### 2. OAuth Token Management
- ✅ Retrieves Google OAuth tokens from user session
- ✅ Implements automatic token refresh on expiration
- ✅ Handles 401 errors with retry mechanism
- ✅ Uses environment variables for OAuth credentials

### 3. Google Calendar API Integration
- ✅ Creates calendar events with `conferenceDataVersion=1`
- ✅ Includes `conferenceData.createRequest` for Meet links
- ✅ Sets proper timezone handling
- ✅ Sends calendar invites to all attendees
- ✅ Extracts Meet link from API response

### 4. Database Operations
- ✅ Stores meeting data in `meetings` table
- ✅ Links to courses when `courseId` provided
- ✅ Handles database errors with cleanup
- ✅ Returns complete meeting object

### 5. Analytics Tracking
- ✅ Logs `meeting_created` event to `meeting_analytics`
- ✅ Includes metadata (attendee count, course ID, etc.)
- ✅ Non-blocking analytics (doesn't fail on analytics errors)

## Environment Variables Required

```bash
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Error Handling

### Common Error Scenarios

1. **Missing Authentication**
   ```json
   { "error": "No authorization header" }
   ```

2. **Invalid User**
   ```json
   { "error": "Unauthorized" }
   ```

3. **Missing Required Fields**
   ```json
   { "error": "Missing required fields: summary, startTime, endTime, and attendees" }
   ```

4. **Invalid Date Format**
   ```json
   { "error": "Invalid date format for startTime or endTime" }
   ```

5. **Invalid Date Logic**
   ```json
   { "error": "Start time must be before end time" }
   ```

6. **No Google OAuth Token**
   ```json
   { "error": "No valid Google OAuth session found. Please sign in with Google again." }
   ```

7. **Google Calendar API Error**
   ```json
   { "error": "Failed to create calendar event: 403 Forbidden" }
   ```

8. **Token Refresh Failure**
   ```json
   { "error": "Failed to refresh Google OAuth token" }
   ```

## Implementation Details

### Token Refresh Logic
```typescript
// Automatic token refresh on 401 errors
if (calendarResponse.status === 401 && attempt === 1 && refreshToken) {
  console.log('Access token expired, refreshing...');
  const newToken = await refreshAccessToken(refreshToken);
  return makeCalendarRequest(newToken, 2);
}
```

### Google Calendar API Request
```typescript
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1
{
  summary: "Meeting Title",
  description: "Meeting description",
  start: { 
    dateTime: "2024-01-15T14:00:00Z", 
    timeZone: "America/New_York" 
  },
  end: { 
    dateTime: "2024-01-15T15:00:00Z", 
    timeZone: "America/New_York" 
  },
  attendees: [{ email: "attendee@example.com" }],
  conferenceData: {
    createRequest: {
      requestId: "meet-1704459600000-uuid",
      conferenceSolutionKey: { type: "hangoutsMeet" }
    }
  },
  sendUpdates: "all"
}
```

### Database Schema Integration
- Uses `meetings` table with proper foreign keys
- Stores Google Meet link in `meet_link` field
- Links to `courses` table via `course_id`
- Maintains audit trail with `created_at`/`updated_at`

### Analytics Data Structure
```typescript
{
  meeting_id: "uuid",
  user_id: "uuid", 
  event_type: "meeting_created",
  event_data: {
    attendee_count: 2,
    course_id: "uuid",
    calendar_event_id: "google-calendar-event-id",
    has_meet_link: true,
    created_via: "edge_function"
  }
}
```

## Testing

### Local Testing
```bash
supabase functions serve create-google-meet --env-file .env.local
```

### Deploy to Supabase
```bash
supabase functions deploy create-google-meet
```

### Test Request
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-google-meet' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "summary": "Test Meeting",
    "startTime": "2024-01-15T14:00:00Z",
    "endTime": "2024-01-15T15:00:00Z",
    "attendees": ["test@example.com"]
  }'
```

## Security Considerations

1. **JWT Validation**: All requests validated against Supabase auth
2. **Token Security**: OAuth tokens handled securely via Supabase session
3. **Environment Variables**: Sensitive credentials stored in environment
4. **Error Handling**: No sensitive data exposed in error messages
5. **CORS**: Proper CORS headers for cross-origin requests
6. **Rate Limiting**: Inherits Supabase Edge Function rate limits

## Integration with Frontend

Use with the `MeetingManager` class:
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('create-google-meet', {
  body: {
    summary: "Coaching Session",
    startTime: "2024-01-15T14:00:00Z",
    endTime: "2024-01-15T15:00:00Z",
    attendees: ["student@example.com"]
  }
});
```
