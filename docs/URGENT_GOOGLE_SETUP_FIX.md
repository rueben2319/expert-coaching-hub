# 🚨 URGENT: Google Cloud Project Deleted - Setup Fix

## Issue
Your Google Cloud Project (#572048823691) has been deleted, causing all Google Calendar API calls to fail with 403 Forbidden errors.

## Required Actions (URGENT)

### Step 1: Create New Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `expert-coaching-hub` (or your preferred name)
4. Click **"Create"**
5. **IMPORTANT**: Note the new Project ID

### Step 2: Enable Google Calendar API
1. In the new project, go to **APIs & Services** → **Library**
2. Search for **"Google Calendar API"**
3. Click on it and press **"Enable"**

### Step 3: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure OAuth consent screen first:
   - Choose **"External"** user type
   - Fill required fields:
     - App name: "Expert Coaching Hub"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes:
     ```
     https://www.googleapis.com/auth/userinfo.email
     https://www.googleapis.com/auth/userinfo.profile
     https://www.googleapis.com/auth/calendar.events
     https://www.googleapis.com/auth/calendar.readonly
     ```
   - Add test users: `ruebenisaac1@gmail.com`

4. Create OAuth client:
   - Application type: **"Web application"**
   - Name: "Expert Coaching Hub Web Client"
   - Authorized JavaScript origins:
     ```
     http://localhost:8080
     https://vbrxgaxjmpwusbbbzzgl.supabase.co
     ```
   - Authorized redirect URIs:
     ```
     https://vbrxgaxjmpwusbbbzzgl.supabase.co/auth/v1/callback
     ```

5. **SAVE THE CREDENTIALS**: Download the JSON file or copy Client ID and Secret

### Step 4: Update Supabase Configuration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **Providers**
3. Find **Google** provider
4. Update with NEW credentials:
   - **Client ID**: [New Client ID from Step 3]
   - **Client Secret**: [New Client Secret from Step 3]
   - **Additional Scopes**: 
     ```
     https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly
     ```

### Step 5: Update Edge Function Environment Variables
If you're using the Edge Function, update these environment variables in Supabase:
1. Go to **Edge Functions** → **Settings**
2. Add/Update:
   - `GOOGLE_CLIENT_ID`: [New Client ID]
   - `GOOGLE_CLIENT_SECRET`: [New Client Secret]

### Step 6: Test the Fix
1. Clear browser cookies/cache
2. Sign out of your app completely
3. Sign in again with Google
4. Check if Calendar integration works

## Verification Steps

### 1. Check OAuth Consent Screen Status
- Ensure app is in "Testing" mode with you as a test user
- OR publish the app for production use

### 2. Verify API Quotas
- Go to **APIs & Services** → **Quotas**
- Ensure Calendar API has sufficient quota

### 3. Test API Access
Use the debug tools in your Sessions page:
1. Click "Log Token Status"
2. Check console for token information
3. Verify no 403 errors

## Common Issues After Fix

### Issue: "Access blocked" during OAuth
**Solution**: Add your email to test users in OAuth consent screen

### Issue: "Redirect URI mismatch"
**Solution**: Ensure redirect URI exactly matches Supabase callback URL

### Issue: Still getting 403 errors
**Solution**: 
- Wait 5-10 minutes for changes to propagate
- Clear all browser data
- Re-authenticate completely

## Security Notes
- Never commit new credentials to version control
- Use environment variables for sensitive data
- Regularly rotate OAuth credentials
- Monitor API usage in Google Cloud Console

## Timeline
This fix should take 15-30 minutes to complete. The Calendar integration will be non-functional until these steps are completed.
