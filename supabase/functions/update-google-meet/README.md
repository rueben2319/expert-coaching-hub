# Update Google Meet Edge Function

## Overview
Server-side Supabase Edge Function that updates existing Google Calendar events with Google Meet links and syncs changes to the local database.

## Endpoint
```
PATCH /functions/v1/update-google-meet
```

## Authentication
Requires valid Supabase JWT token in Authorization header:
```
Authorization: Bearer <supabase-jwt-token>
```

## Request Body
```json
{
  "meetingId": "uuid-of-meeting",
  "summary": "Updated Meeting Title (optional)",
  "description": "Updated description (optional)",
  "startTime": "2024-01-15T14:00:00.000Z (optional)",
  "endTime": "2024-01-15T15:00:00.000Z (optional)",
  "attendees": ["user1@example.com", "user2@example.com"] // optional
}
```

### Required Fields
- `meetingId`: UUID of the meeting to update

### Optional Fields
- `summary`: New meeting title
- `description`: New meeting description  
- `startTime`: New start time (ISO 8601 format)
- `endTime`: New end time (ISO 8601 format)
- `attendees`: Array of attendee email addresses

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "meeting": {
    "id": "meeting-uuid",
    "summary": "Updated Meeting Title",
    "description": "Updated description",
    "start_time": "2024-01-15T14:00:00.000Z",
    "end_time": "2024-01-15T15:00:00.000Z",
    "meet_link": "https://meet.google.com/abc-defg-hij",
    "calendar_event_id": "google-calendar-event-id",
    "attendees": ["user1@example.com", "user2@example.com"],
    "status": "scheduled",
    "updated_at": "2024-01-15T12:00:00.000Z"
  },
  "calendar_event": {
    "id": "google-calendar-event-id",
    "htmlLink": "https://calendar.google.com/event?eid=...",
    "meetLink": "https://meet.google.com/abc-defg-hij"
  },
  "message": "Meeting updated successfully"
}
```

### Error Response (400)
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Features

### 🔄 Update Capabilities
- **Meeting Details**: Update title, description, time
- **Attendee Management**: Add/remove attendees
- **Flexible Updates**: Update any combination of fields
- **Partial Updates**: Only specified fields are updated

### 🔗 Google Calendar Integration
- **Event Updates**: Syncs changes to Google Calendar
- **Meet Link Preservation**: Maintains Google Meet links
- **Token Refresh**: Automatic OAuth token refresh
- **Error Handling**: Graceful API failure handling

### 📊 Database Synchronization
- **Local Updates**: Updates meeting record in Supabase
- **Data Consistency**: Ensures calendar and database stay in sync
- **Audit Trail**: Tracks update timestamps
- **Security**: RLS ensures users can only update their own meetings

### 📈 Analytics Integration
- **Update Tracking**: Logs meeting update events
- **Field Tracking**: Records which fields were updated
- **Attendee Metrics**: Tracks attendee count changes
- **Performance Data**: Monitors update success rates

## Security Features

### 🔐 Authentication & Authorization
- **JWT Validation**: Verifies Supabase authentication token
- **User Ownership**: Ensures users can only update their own meetings
- **OAuth Security**: Secure Google token handling
- **RLS Protection**: Database-level security policies

### 🛡️ Input Validation
- **Required Fields**: Validates meeting ID presence
- **Meeting Existence**: Verifies meeting exists and user has access
- **Calendar Link**: Ensures meeting has associated calendar event
- **Data Sanitization**: Validates and sanitizes input data

## Error Handling

### Common Error Scenarios
1. **Missing Meeting ID**: Returns error if meetingId not provided
2. **Meeting Not Found**: Returns error if meeting doesn't exist or user lacks access
3. **No Calendar Link**: Returns error if meeting not linked to Google Calendar
4. **Invalid Auth**: Returns error if authentication fails
5. **Google API Errors**: Handles and reports Google Calendar API failures
6. **Token Expiry**: Automatically refreshes expired OAuth tokens

### Error Response Codes
- `400`: Bad request (validation errors, missing data)
- `401`: Unauthorized (invalid or missing auth token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (meeting doesn't exist)
- `500`: Internal server error (unexpected failures)

## Usage Examples

### Update Meeting Title
```javascript
const response = await fetch('/functions/v1/update-google-meet', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meetingId: 'meeting-uuid',
    summary: 'New Meeting Title'
  })
});
```

### Update Meeting Time
```javascript
const response = await fetch('/functions/v1/update-google-meet', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meetingId: 'meeting-uuid',
    startTime: '2024-01-15T15:00:00.000Z',
    endTime: '2024-01-15T16:00:00.000Z'
  })
});
```

### Update Attendees
```javascript
const response = await fetch('/functions/v1/update-google-meet', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meetingId: 'meeting-uuid',
    attendees: ['new@example.com', 'existing@example.com']
  })
});
```

### Full Update
```javascript
const response = await fetch('/functions/v1/update-google-meet', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meetingId: 'meeting-uuid',
    summary: 'Updated Meeting',
    description: 'New description',
    startTime: '2024-01-15T15:00:00.000Z',
    endTime: '2024-01-15T16:00:00.000Z',
    attendees: ['user1@example.com', 'user2@example.com']
  })
});
```

## Environment Variables Required
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

## Dependencies
- Deno runtime
- Supabase client library
- Google Calendar API v3

## Related Functions
- `create-google-meet`: Creates new meetings
- `cancel-google-meet`: Cancels existing meetings
- `get-meeting-details`: Retrieves meeting information

## Testing
Test the function using curl or your preferred HTTP client:

```bash
curl -X PATCH https://your-project.supabase.co/functions/v1/update-google-meet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meetingId": "your-meeting-uuid",
    "summary": "Updated Meeting Title"
  }'
```
