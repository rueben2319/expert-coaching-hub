# Google OAuth Setup Guide

## Current Issue: Access Blocked (Error 403)

Your Google OAuth app is in testing mode and needs configuration to allow access.

## Immediate Fix: Add Test Users

### Step 1: Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one linked to your Supabase app)

### Step 2: Configure OAuth Consent Screen
1. Navigate to **APIs & Services** → **OAuth consent screen**
2. You should see your app configuration

### Step 3: Add Test Users
1. Scroll down to **Test users** section
2. Click **+ ADD USERS**
3. Add these emails:
   ```
   ruebenisaac1@gmail.com
   ```
4. Add any other emails that need access during development
5. Click **SAVE**

### Step 4: Verify Configuration
Ensure these settings are correct:

#### OAuth Consent Screen Settings:
- **User Type**: External (for public access) or Internal (for organization only)
- **App Name**: "Experts Coaching Hub" (or your preferred name)
- **User Support Email**: Your email
- **Developer Contact Email**: Your email

#### Scopes (Required):
```
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
```

#### Authorized Domains:
```
supabase.co
```

## Supabase Configuration

### Update Google Provider Settings
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **Providers**
3. Configure Google provider:

```
Client ID: [Your Google OAuth Client ID]
Client Secret: [Your Google OAuth Client Secret]
Additional Scopes: https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly
```

### Redirect URLs
Ensure these are configured in both Google Cloud Console and Supabase:
```
https://vbrxgaxjmpwusbbbzzgl.supabase.co/auth/v1/callback
```

## Testing the Fix

### Step 1: Clear Browser Data
1. Clear cookies and cache for your app
2. Or use an incognito/private browsing window

### Step 2: Test Authentication
1. Go to your app's auth page
2. Click "Continue with Google"
3. You should now be able to authenticate successfully

### Step 3: Verify Calendar Access
1. After authentication, check the Google Calendar status component
2. It should show "Connected" if everything is working

## Production Deployment

### For Public Release (Recommended)
1. **Complete App Information**:
   - Add app logo (120x120px)
   - Privacy policy URL
   - Terms of service URL
   - App homepage URL

2. **Submit for Verification**:
   - Click **PUBLISH APP** in OAuth consent screen
   - Fill out the verification form
   - Wait for Google's approval (can take 1-6 weeks)

3. **Domain Verification**:
   - Verify ownership of your domain
   - Add domain to authorized domains list

### For Internal/Limited Use
1. Keep app in **Testing** mode
2. Add all required users to test users list
3. Maximum 100 test users allowed

## Troubleshooting

### Common Issues:

1. **"Access blocked" error**
   - Add user email to test users list
   - Ensure OAuth consent screen is properly configured

2. **"Redirect URI mismatch"**
   - Check redirect URLs in Google Cloud Console
   - Ensure Supabase callback URL is added

3. **"Invalid client" error**
   - Verify Client ID and Secret in Supabase
   - Ensure they match Google Cloud Console credentials

4. **Scope errors**
   - Verify calendar scopes are added to OAuth consent screen
   - Check additional scopes in Supabase provider settings

### Debug Steps:
1. Check browser developer console for detailed errors
2. Verify all URLs match between Google Cloud Console and Supabase
3. Test with a fresh incognito browser session
4. Ensure the Google Cloud project has Calendar API enabled

## Security Notes

- Never commit Client ID/Secret to version control
- Use environment variables for sensitive credentials
- Regularly rotate OAuth credentials
- Monitor OAuth usage in Google Cloud Console
- Set up proper scopes (principle of least privilege)

## Support

If issues persist:
1. Check Google Cloud Console logs
2. Review Supabase authentication logs
3. Verify all configuration steps above
4. Contact Google Cloud Support for verification issues
