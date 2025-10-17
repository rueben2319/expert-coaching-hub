# Google Calendar Integration Setup Guide

## Overview
This guide walks you through setting up Google Calendar integration with Google Meet for the Expert Coaching Hub application.

## Prerequisites
- Supabase project with Google OAuth already configured
- Google Cloud Console project
- Admin access to both platforms

## Step 1: Configure Google Cloud Console

### 1.1 Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services > Library**
4. Enable the following APIs:
   - **Google Calendar API**
   - **Google+ API** (if not already enabled)

### 1.2 Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Add the following scopes to your consent screen:
   ```
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/calendar.readonly
   ```
3. Update the application description to mention calendar access
4. Save the configuration

### 1.3 Update OAuth 2.0 Client
1. Go to **APIs & Services > Credentials**
2. Find your existing OAuth 2.0 Client ID (used by Supabase)
3. Add your domain to **Authorized JavaScript origins** if not already present
4. Ensure your Supabase callback URL is in **Authorized redirect URIs**

## Step 2: Configure Supabase Auth

### 2.1 Update Google Provider Settings
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication > Providers**
3. Find the **Google** provider
4. Update the configuration:
   - **Client ID**: Your Google OAuth client ID
   - **Client Secret**: Your Google OAuth client secret
   - **Additional Scopes**: Add the following scopes:
     ```
     https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly
     ```

### 2.2 Enable Provider Token Storage
Ensure that **"Enable provider refresh tokens"** is checked in your Google provider settings. This allows the application to store and use refresh tokens for API calls.

## Step 3: Database Migration

Run the meetings migration if you haven't already:

```bash
# Apply the meetings migration
supabase db push
```

The migration file `20251010084731_meetings_functionality.sql` should already be in your migrations folder.

## Step 4: Test the Integration

### 4.1 Test OAuth Flow
1. Start your development server
2. Go to the authentication page
3. Click "Continue with Google"
4. Verify that the consent screen shows calendar permissions
5. Complete the authentication

### 4.2 Test Calendar Access
1. After authentication, the `GoogleCalendarStatus` component should show "Connected"
2. Try creating a meeting using the `MeetingManager.createMeeting()` method
3. Verify that:
   - A Google Calendar event is created
   - A Google Meet link is generated
   - The meeting is stored in your database

## Step 5: Implementation Examples

### Creating a Meeting
```typescript
import { MeetingManager } from '@/lib/meetingUtils';

const createMeeting = async () => {
  try {
    const meeting = await MeetingManager.createMeeting({
      summary: "Coaching Session",
      description: "Weekly coaching session",
      startTime: "2024-01-15T10:00:00Z",
      endTime: "2024-01-15T11:00:00Z",
      attendeeEmails: ["student@example.com"],
      courseId: "course-uuid-here"
    });
    
    console.log("Meeting created:", meeting);
    console.log("Google Meet link:", meeting.meet_link);
  } catch (error) {
    console.error("Failed to create meeting:", error);
  }
};
```

### Using the Calendar Status Component
```typescript
import { GoogleCalendarStatus } from '@/components/GoogleCalendarStatus';

// Full component
<GoogleCalendarStatus 
  onStatusChange={(isConnected) => console.log("Calendar status:", isConnected)}
  showReconnectButton={true}
/>

// Compact version
<GoogleCalendarStatus 
  compact={true}
  onStatusChange={(isConnected) => setCalendarConnected(isConnected)}
/>
```

### Using the Calendar Hook
```typescript
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

const MyComponent = () => {
  const { 
    createMeeting, 
    isCreatingMeeting, 
    validateAccess,
    useCalendarEvents 
  } = useGoogleCalendar();

  const { data: events, isLoading } = useCalendarEvents({
    timeMin: new Date().toISOString(),
    maxResults: 10
  });

  const handleCreateMeeting = async () => {
    try {
      await createMeeting({
        summary: "New Meeting",
        startTime: "2024-01-15T10:00:00Z",
        endTime: "2024-01-15T11:00:00Z",
        attendeeEmails: ["attendee@example.com"]
      });
    } catch (error) {
      console.error("Failed to create meeting:", error);
    }
  };

  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
};
```

## Troubleshooting

### Common Issues

1. **"Invalid scope" error**
   - Verify that the scopes are correctly configured in both Google Cloud Console and Supabase
   - Ensure there are no typos in the scope URLs

2. **"Access token not available" error**
   - Check that provider refresh tokens are enabled in Supabase
   - Verify that the user has completed the OAuth flow with calendar permissions

3. **Calendar API quota exceeded**
   - Check your Google Cloud Console quota limits
   - Implement proper error handling and retry logic

4. **Meeting creation fails**
   - Verify that the Google Calendar API is enabled
   - Check that the user has write access to their calendar
   - Ensure the meeting times are valid and in the future

### Debug Mode
To enable debug logging, add this to your environment:
```
VITE_DEBUG_GOOGLE_CALENDAR=true
```

## Security Considerations

1. **Token Storage**: OAuth tokens are securely stored in Supabase sessions
2. **RLS Policies**: All database operations respect Row Level Security
3. **Scope Limitation**: Only request necessary calendar scopes
4. **Error Handling**: Implement proper error boundaries to prevent token exposure

## Next Steps

After completing this setup:
1. Test the integration thoroughly in development
2. Update your production Supabase and Google Cloud configurations
3. Consider implementing additional features like:
   - Calendar sync for existing events
   - Meeting reminders
   - Bulk meeting operations
   - Calendar availability checking
