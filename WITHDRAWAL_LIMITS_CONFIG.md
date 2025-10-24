# Withdrawal Limits Configuration

This document describes the configurable withdrawal limits that can be set via environment variables.

## Frontend Environment Variables (Vite)

Set these in your `.env` file for the frontend:

```bash
# Maximum withdrawal per transaction
VITE_MAX_WITHDRAWAL=15000

# Minimum withdrawal amount
VITE_MIN_WITHDRAWAL=10

# Maximum daily withdrawal
VITE_DAILY_WITHDRAWAL_LIMIT=50000

# Credits must age this many days before withdrawal
VITE_CREDIT_AGING_DAYS=3

# Rate limit: requests per hour
VITE_RATE_LIMIT_PER_HOUR=5

# Credit to MWK conversion rate
VITE_CONVERSION_RATE=100
```

## Backend Environment Variables (Supabase Edge Functions)

Set these in your Supabase project settings or via CLI:

```bash
# Maximum withdrawal per transaction
MAX_WITHDRAWAL=10000

# Minimum withdrawal amount
MIN_WITHDRAWAL=10

# Maximum daily withdrawal
DAILY_WITHDRAWAL_LIMIT=50000

# Credits must age this many days before withdrawal
CREDIT_AGING_DAYS=3

# Rate limit: requests per hour
RATE_LIMIT_PER_HOUR=5

# Credit to MWK conversion rate
CONVERSION_RATE=100
```

## Default Values

If environment variables are not set, the following defaults apply:

- **MAX_WITHDRAWAL**: 10,000 credits
- **MIN_WITHDRAWAL**: 10 credits
- **DAILY_WITHDRAWAL_LIMIT**: 50,000 credits
- **CREDIT_AGING_DAYS**: 3 days
- **RATE_LIMIT_PER_HOUR**: 5 requests
- **CONVERSION_RATE**: 100 (1 credit = 100 MWK)

## Configuration Files

- **Frontend**: `src/lib/withdrawalLimits.ts`
- **Backend**: Constants in `supabase/functions/immediate-withdrawal/index.ts`

## Usage

Both frontend and backend now read from the same configuration source, ensuring consistency between client-side validation and server-side enforcement.

To change limits:
1. Update the environment variables
2. Redeploy both frontend and backend functions
3. The UI will automatically reflect the new limits
