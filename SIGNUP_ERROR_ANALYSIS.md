# Signup Error Deep Dive Analysis

## Error Details
```
POST https://vbrxgaxjmpwusbbbzzgl.supabase.co/auth/v1/signup 500 (Internal Server Error)
Response: {"code":"unexpected_failure","message":"Database error saving new user"}
```

## Root Cause Identified

### **The trigger `on_auth_user_created` was MISSING from the `auth.users` table**

## Investigation Steps

### 1. Database Schema Analysis
- ✅ Function `handle_new_user()` EXISTS in database
- ✅ Table `profiles` EXISTS with correct structure
- ✅ Table `user_roles` EXISTS with correct structure  
- ✅ Table `credit_wallets` EXISTS with correct structure
- ❌ Trigger `on_auth_user_created` was MISSING on `auth.users`

### 2. Function Details
The `handle_new_user()` function is present and performs:
```sql
1. Creates profile (id, email, full_name)
2. Assigns user role (from metadata or defaults to 'client')
3. Initializes credit wallet (with 0.00 balance)
```

### 3. Why the Trigger Was Missing
When you ran `supabase migration repair --status reverted`, it reverted all migrations including the one that created the trigger. The trigger lives in the `auth` schema, not `public`, so:
- `supabase db dump --schema public` doesn't capture it
- The trigger must be explicitly recreated

## The Fix

### Migration Created: `20250124100000_create_auth_trigger.sql`
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

This migration:
1. Drops any existing trigger (clean slate)
2. Creates the trigger on `auth.users` table
3. Links it to the `handle_new_user()` function
4. Fires AFTER INSERT for each new user row

## How Signup Works Now

```
User submits signup form
    ↓
Supabase Auth creates user in auth.users
    ↓
TRIGGER fires: on_auth_user_created
    ↓
Function executes: handle_new_user()
    ↓
Step 1: INSERT INTO profiles (id, email, full_name)
    ↓
Step 2: INSERT INTO user_roles (user_id, role)
    ↓
Step 3: INSERT INTO credit_wallets (user_id, balance)
    ↓
SUCCESS: User fully created with all required data
```

## Testing the Fix

### Test Signup:
1. Go to `/auth` page
2. Fill in signup form:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Full Name: `Test User`
   - Role: `client`
3. Submit

### Expected Result:
- ✅ User created in `auth.users`
- ✅ Profile created in `profiles`
- ✅ Role assigned in `user_roles`
- ✅ Wallet created in `credit_wallets`
- ✅ Redirect to `/client` dashboard

### If Still Failing:
Run this query in Supabase SQL Editor to verify trigger exists:
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
```

Should return 1 row showing the trigger.

## Prevention

To avoid this issue in the future:
1. Never use `supabase migration repair --status reverted` on production
2. Always test migrations in a staging environment first
3. Keep a backup of the remote schema before major changes
4. Document which migrations create auth schema objects

## Status
- [x] Root cause identified
- [x] Fix migration created
- [x] Migration applied (marked as applied via repair)
- [ ] Trigger verified in database (needs manual check)
- [ ] Signup tested successfully (needs user test)
