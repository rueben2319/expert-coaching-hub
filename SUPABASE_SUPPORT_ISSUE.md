# Supabase Auth Signup Error - Support Request

## Issue Summary
User signup fails with 500 Internal Server Error despite trigger function completing successfully.

## Error Details
```
POST https://vbrxgaxjmpwusbbbzzgl.supabase.co/auth/v1/signup 500 (Internal Server Error)
Response: {"code":"unexpected_failure","message":"Database error saving new user"}
```

## Project Details
- **Project ID**: `vbrxgaxjmpwusbbbzzgl`
- **Region**: (Your region)
- **Plan**: (Your plan)

## What We've Tried

### 1. Verified Trigger Function Works ✅
The `handle_new_user()` trigger function executes completely and successfully:
```
✅ handle_new_user triggered
✅ Step 1: Profile created successfully
✅ Step 2: Role assigned successfully  
✅ Step 3: Credit wallet created successfully
✅ handle_new_user completed successfully
```

### 2. Error Occurs AFTER Trigger Completes ❌
Immediately after the trigger succeeds, we get:
```
❌ ERROR: relation "credit_wallets" does not exist
❌ ERROR: current transaction is aborted
```

### 3. Connection Context
The error occurs in a connection from `supabase_auth_admin`:
```
connection authorized: user=supabase_auth_admin database=postgres
```

## Root Cause Analysis

### The Problem
Something in the Supabase Auth service (running as `supabase_auth_admin`) is trying to query `credit_wallets` without the schema prefix, and it cannot find the table because:

1. The table exists as `public.credit_wallets`
2. The query is looking for just `credit_wallets` (no schema prefix)
3. The `supabase_auth_admin` role's `search_path` doesn't include `public` schema

### What We've Attempted

#### ✅ Fixed Trigger Function
- Added proper error handling
- Used explicit `public.` schema prefixes
- Set `search_path = public, auth` in function

#### ✅ Fixed RLS Policies
- Added permissive INSERT policies for trigger
- Disabled RLS temporarily (didn't help)

#### ✅ Set search_path for User Roles
```sql
ALTER ROLE authenticator SET search_path TO public, auth;
ALTER ROLE authenticated SET search_path TO public, auth;
ALTER ROLE anon SET search_path TO public, auth;
ALTER ROLE service_role SET search_path TO public, auth;
ALTER DATABASE postgres SET search_path TO public, auth;
```

#### ❌ Cannot Modify Reserved Roles
We cannot modify `supabase_auth_admin` role:
```
ERROR: "supabase_auth_admin" is a reserved role, only superusers can modify it
```

## Database Schema

### Tables Involved
```sql
-- All tables exist in public schema
public.profiles (id uuid PRIMARY KEY)
public.user_roles (id uuid, user_id uuid UNIQUE)
public.credit_wallets (id uuid, user_id uuid UNIQUE)
```

### Trigger Setup
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## Log Timeline (Reading Bottom to Top)

```
1761309551973000 - handle_new_user triggered
1761309551973000 - Step 1: Creating profile
1761309551974000 - Step 1: Profile created successfully
1761309551974000 - Step 2: Assigning role
1761309551974000 - Step 2a: Role determined as client
1761309551974000 - Step 2b: Role assigned successfully
1761309551974000 - Step 3: Creating credit wallet
1761309551975000 - Step 3: Credit wallet created successfully
1761309551975000 - handle_new_user completed successfully
1761309551975000 - ERROR: relation "credit_wallets" does not exist
1761309551975000 - ERROR: current transaction is aborted
```

## Questions for Supabase Support

1. **Is there an Auth hook or internal query** that runs after user creation that might be trying to access `public.credit_wallets`?

2. **How can we configure the `supabase_auth_admin` role's search_path** to include the `public` schema?

3. **Is there a Supabase dashboard setting** for Auth hooks or custom claims that might be querying our tables?

4. **Could this be related to JWT claims generation** trying to fetch user data after signup?

5. **Is there a way to see the full query** that's failing with "relation credit_wallets does not exist"?

## Workaround Needed

We need either:
- A way to set `search_path` for `supabase_auth_admin` role
- A way to disable whatever Auth service query is failing
- Guidance on proper schema setup for custom user tables

## Impact
- **Critical**: Users cannot sign up
- **Blocking**: Application launch
- **Urgency**: High

## Additional Context
- This is a production application
- We've spent several hours debugging
- All migrations are properly applied
- Local development has same issue
- No custom Auth hooks configured in dashboard (that we know of)

## Files Available
- Full migration history
- Complete database schema dump
- Detailed PostgreSQL logs
- Trigger function source code

Please advise on how to resolve this issue. Thank you!
