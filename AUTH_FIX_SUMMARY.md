# Authentication & Authorization System Fix

## Issue Summary

Users were experiencing a **database error when creating new accounts**. The error occurred due to a conflict in the user role assignment process.

## Root Cause

The system had a **duplicate role insertion problem**:

1. **Database Trigger**: The `handle_new_user()` trigger function attempted to INSERT a hardcoded 'client' role for all new users
2. **Application Code**: After signup, `Auth.tsx` also attempted to INSERT the user's selected role (client or coach)
3. **Database Constraint**: The `user_roles` table had a UNIQUE constraint on `(user_id, role)`

### The Conflict

- When a user selected **'client'** during signup:
  - ✗ Trigger inserts 'client' role → Success
  - ✗ Auth.tsx tries to insert 'client' role → **FAILS** (duplicate)
  
- When a user selected **'coach'** during signup:
  - Trigger inserts 'client' role → Success  
  - Auth.tsx inserts 'coach' role → Success
  - Result: User has **both** roles (unintended behavior)

## Fixes Applied

### 1. Updated Database Trigger Function ✅

**File**: `supabase/migrations/20241022000001_create_credit_wallet_trigger.sql`

**Changes**:
- Modified `handle_new_user()` to read role from user metadata instead of hardcoding 'client'
- Added `ON CONFLICT` clauses to prevent duplicate insertions
- Created the missing trigger on `auth.users` table

```sql
-- Now reads role from metadata
user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client')::public.app_role;

-- Uses UPSERT to avoid conflicts
INSERT INTO public.user_roles (user_id, role)
VALUES (NEW.id, user_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger creation (was missing)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 2. Enforced Single Role Per User ✅

**File**: `supabase/migrations/20251024000005_fix_user_roles_constraint.sql`

**Changes**:
- Removed composite UNIQUE constraint on `(user_id, role)` which allowed multiple roles
- Added UNIQUE constraint on `user_id` only to enforce **one role per user**
- Updated trigger to use `ON CONFLICT (user_id) DO UPDATE` for proper role updates

```sql
-- Enforce single role per user
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Handle role updates properly
INSERT INTO public.user_roles (user_id, role)
VALUES (NEW.id, user_role)
ON CONFLICT (user_id) DO UPDATE SET role = user_role;
```

### 3. Removed Duplicate Code from Auth.tsx ✅

**File**: `src/pages/Auth.tsx`

**Changes**:
- Removed redundant role insertion code after signup
- The trigger now handles all role creation automatically

```typescript
// BEFORE (❌ caused conflicts)
if (data.user) {
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: data.user.id, role: selectedRole });
}

// AFTER (✅ trigger handles it)
// Note: User role is automatically created by the handle_new_user trigger
// based on the role passed in user metadata
```

### 4. Updated Edge Function ✅

**File**: `supabase/functions/upsert-user-role/index.ts`

**Changes**:
- Added clarifying comment about single role constraint
- Confirmed `onConflict: 'user_id'` usage is correct

## How It Works Now

### New User Signup Flow

1. **User fills signup form** → Selects role (client or coach)
2. **Auth.tsx calls signUp()** → Passes role in `options.data.role`
3. **Supabase creates user** → Stores role in `raw_user_meta_data`
4. **Trigger fires** → `on_auth_user_created` executes `handle_new_user()`
5. **Trigger creates**:
   - User profile
   - User role (from metadata)
   - Credit wallet
6. **User is ready** → Can log in with correct role

### OAuth Flow

The OAuth flow already correctly used UPSERT, so it continues to work properly:

```typescript
await supabase
  .from('user_roles')
  .upsert({ user_id: user.id, role: desiredRole }, { onConflict: 'user_id' });
```

## Database Schema Changes

### Before
```sql
-- Allowed multiple roles per user
UNIQUE (user_id, role)
```

### After
```sql
-- Enforces single role per user
UNIQUE (user_id)
```

## Testing Checklist

Before deploying, verify:

- [ ] **New client signup** → Creates user with 'client' role
- [ ] **New coach signup** → Creates user with 'coach' role  
- [ ] **OAuth signup** → Correctly assigns selected role
- [ ] **No duplicate role errors** → All signups succeed
- [ ] **Role fetching** → `useAuth` correctly retrieves single role
- [ ] **Profile creation** → User profile is created automatically
- [ ] **Credit wallet** → Wallet is initialized with 0 balance

## Migration Instructions

### For Development/Local

```bash
# Reset local database
supabase db reset

# Or apply migrations manually
supabase db push
```

### For Production

```bash
# Apply new migration (will update existing function and add constraint)
supabase db push --db-url <production-url>

# Verify no users have duplicate roles
SELECT user_id, COUNT(*) as role_count 
FROM user_roles 
GROUP BY user_id 
HAVING COUNT(*) > 1;

# If any users have multiple roles, decide which role to keep
# Then delete duplicates before the constraint is applied
```

## Files Modified

1. ✅ `supabase/migrations/20241022000001_create_credit_wallet_trigger.sql`
2. ✅ `supabase/migrations/20251024000005_fix_user_roles_constraint.sql` (NEW)
3. ✅ `src/pages/Auth.tsx`
4. ✅ `supabase/functions/upsert-user-role/index.ts`

## Breaking Changes

⚠️ **Schema Change**: The new UNIQUE constraint on `user_id` prevents users from having multiple roles. If your system previously relied on users having multiple roles, this will break that functionality.

**Migration Note**: Before applying the new constraint, ensure no existing users have multiple roles in the database.

## Additional Improvements

Consider implementing:

1. **Error Tracking**: Add Sentry or similar to track signup errors
2. **Audit Logging**: Log all role changes to `user_role_changes` table
3. **Email Verification**: Ensure role is set even if email verification fails
4. **Admin Dashboard**: UI for admins to manage user roles

---

**Fixed By**: Cursor Agent  
**Date**: 2024-10-24  
**Status**: ✅ Ready for Testing
