# Verification Steps for Auth Fix

## Quick Verification Commands

### 1. Check Database Schema

```sql
-- Verify the user_roles table has the correct constraint
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'user_roles' AND table_schema = 'public';

-- Expected: user_roles_user_id_key (UNIQUE on user_id only)
```

### 2. Check Trigger Exists

```sql
-- Verify the trigger is attached to auth.users
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Expected: Should show trigger on auth.users calling handle_new_user()
```

### 3. Test User Creation

#### Test Case 1: Client Signup
1. Navigate to `/auth`
2. Fill in signup form:
   - Full Name: "Test Client"
   - Email: "testclient@example.com"
   - Role: **Client**
   - Password: "SecurePass123!"
3. Click Sign Up
4. **Expected**: Success message, no database errors

#### Test Case 2: Coach Signup
1. Navigate to `/auth`
2. Fill in signup form:
   - Full Name: "Test Coach"
   - Email: "testcoach@example.com"
   - Role: **Coach**
   - Password: "SecurePass123!"
3. Click Sign Up
4. **Expected**: Success message, no database errors

#### Test Case 3: OAuth Client
1. Click "Continue with Google"
2. Select **Student** role
3. Complete Google OAuth
4. **Expected**: User created with 'client' role

#### Test Case 4: OAuth Coach
1. Click "Continue with Google"
2. Select **Coach** role
3. Complete Google OAuth
4. **Expected**: User created with 'coach' role

### 4. Verify Database Records

```sql
-- Check a newly created user
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'role' as metadata_role,
  ur.role as assigned_role,
  p.full_name as profile_name,
  cw.balance as wallet_balance
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.credit_wallets cw ON u.id = cw.user_id
WHERE u.email = 'testclient@example.com';

-- Expected:
-- - metadata_role = 'client'
-- - assigned_role = 'client'
-- - profile_name = 'Test Client'
-- - wallet_balance = 0.00
```

### 5. Check for Duplicate Roles

```sql
-- Ensure no user has multiple roles
SELECT user_id, COUNT(*) as role_count, ARRAY_AGG(role) as roles
FROM public.user_roles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Expected: No rows (all users should have exactly 1 role)
```

### 6. Browser Console Check

Open browser console and check for errors during signup:
- ❌ No "duplicate key value violates unique constraint" errors
- ❌ No "Error creating user role" messages
- ✅ Should see "Account created! Please check your email to verify"

## Common Issues & Solutions

### Issue 1: Trigger Not Found

**Error**: Trigger `on_auth_user_created` doesn't exist

**Solution**:
```bash
# Apply the migration
supabase db push

# Or manually run:
psql -d postgres -f supabase/migrations/20241022000001_create_credit_wallet_trigger.sql
```

### Issue 2: Constraint Violation

**Error**: `duplicate key value violates unique constraint "user_roles_user_id_role_key"`

**Solution**: The old constraint still exists. Apply the new migration:
```bash
supabase db push
```

### Issue 3: Users Have Multiple Roles

**Error**: Some users have both 'client' and 'coach' roles

**Solution**: Clean up before applying new constraint:
```sql
-- Find users with multiple roles
SELECT user_id, ARRAY_AGG(role ORDER BY created_at) as roles
FROM public.user_roles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- For each user, decide which role to keep, then delete others
DELETE FROM public.user_roles
WHERE id IN (
  SELECT id 
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM public.user_roles
  ) t
  WHERE rn > 1
);
```

## Performance Test

Create 10 users rapidly to ensure no race conditions:

```bash
# Use a script or test tool to create multiple users
# All should succeed without errors
```

## Rollback Plan

If issues occur, rollback:

```sql
-- Revert constraint change
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- Revert trigger (optional - probably safe to keep)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

## Success Criteria

✅ All test cases pass  
✅ No console errors  
✅ No duplicate role errors  
✅ Users can sign up as both client and coach  
✅ OAuth flow works correctly  
✅ Each user has exactly one role  
✅ Profiles and wallets are created automatically  

---

**Last Updated**: 2024-10-24
