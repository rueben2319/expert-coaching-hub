# Signup Error - Transaction Analysis

## Log Analysis (Reading from BOTTOM to TOP - oldest first)

### Timeline of Events:

1. **Connection received** (timestamp: 1761308639301000)
   - User initiates signup

2. **Trigger fires successfully** (timestamp: 1761308645432000)
   ```
   ✅ handle_new_user triggered for user: 383289cb-efa0-44a0-a0f0-81b337992912
   ```

3. **Step 1: Profile Creation** (timestamp: 1761308645434000 - 1761308645451000)
   ```
   ✅ Step 1: Creating profile
   ✅ Step 1: Profile created successfully
   ```

4. **Step 2: Role Assignment** (timestamp: 1761308645452000 - 1761308645459000)
   ```
   ✅ Step 2: Assigning role
   ✅ Step 2a: Role determined as client
   ✅ Step 2b: Role assigned successfully
   ```

5. **Step 3: Credit Wallet Creation** (timestamp: 1761308645459000 - 1761308645463000)
   ```
   ✅ Step 3: Creating credit wallet
   ✅ Step 3: Credit wallet created successfully
   ✅ handle_new_user completed successfully
   ```

6. **ERROR OCCURS** (timestamp: 1761308645464000)
   ```
   ❌ ERROR: relation "credit_wallets" does not exist
   ```

7. **Transaction Aborted** (timestamp: 1761308645465000)
   ```
   ❌ ERROR: current transaction is aborted, commands ignored until end of transaction block
   ```

## Key Observations

### 1. Trigger Completes Successfully
The trigger function runs completely and logs success. All three steps complete without errors.

### 2. Error Happens AFTER Trigger
The error occurs **1 millisecond AFTER** the trigger completes successfully. This suggests:
- The trigger is NOT the source of the error
- Something else in the same transaction is trying to access `credit_wallets`
- That "something else" cannot find the table

### 3. Schema Resolution Issue
The error message is:
```
relation "credit_wallets" does not exist
```

NOT:
```
relation "public.credit_wallets" does not exist
```

This indicates the query is looking for `credit_wallets` without a schema prefix, and the `search_path` doesn't include `public`.

## Possible Causes

### Theory 1: Another Trigger on auth.users
There might be another trigger on `auth.users` that fires AFTER `on_auth_user_created` and tries to query `credit_wallets`.

### Theory 2: Supabase Auth Internal Query
Supabase Auth might be running an internal query after user creation that tries to fetch related data, but the search_path is wrong.

### Theory 3: RLS Policy Check
An RLS policy might be trying to check something against `credit_wallets` but failing due to search_path issues.

### Theory 4: Foreign Key Validation
The foreign key constraint on `credit_wallets.user_id` references `auth.users.id`. During the transaction, PostgreSQL might be validating this constraint and failing due to search_path.

## Investigation Steps

1. **Check for other triggers on auth.users:**
   ```sql
   SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE event_object_schema = 'auth' 
     AND event_object_table = 'users'
   ORDER BY trigger_name;
   ```

2. **Check search_path for different roles:**
   ```sql
   SELECT rolname, rolconfig 
   FROM pg_roles 
   WHERE rolname IN ('authenticator', 'authenticated', 'anon', 'service_role', 'postgres');
   ```

3. **Check RLS policies that might reference credit_wallets:**
   ```sql
   SELECT schemaname, tablename, policyname, qual, with_check
   FROM pg_policies
   WHERE tablename IN ('profiles', 'user_roles')
     AND (qual LIKE '%credit_wallets%' OR with_check LIKE '%credit_wallets%');
   ```

## Recommended Fix

The issue is likely that the transaction includes additional operations after the trigger that don't have the correct search_path. The fix is to ensure all roles have `public` in their search_path.

Migration `20250124100004_fix_schema_search_path.sql` addresses this by:
1. Setting search_path for all Supabase roles
2. Updating the trigger function to explicitly include both `public` and `auth` schemas
