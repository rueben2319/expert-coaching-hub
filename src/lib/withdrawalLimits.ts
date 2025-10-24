// Shared configuration constants for withdrawal limits
// Frontend version using Vite environment variables

export const WITHDRAWAL_LIMITS = {
  // Maximum withdrawal per transaction
  MAX_WITHDRAWAL: parseInt(import.meta.env?.VITE_MAX_WITHDRAWAL || '10000', 10),

  // Minimum withdrawal amount
  MIN_WITHDRAWAL: parseInt(import.meta.env?.VITE_MIN_WITHDRAWAL || '10', 10),

  // Maximum daily withdrawal
  DAILY_LIMIT: parseInt(import.meta.env?.VITE_DAILY_WITHDRAWAL_LIMIT || '50000', 10),

  // Credits must age this many days before withdrawal
  CREDIT_AGING_DAYS: parseInt(import.meta.env?.VITE_CREDIT_AGING_DAYS || '3', 10),

  // Rate limit: requests per hour
  RATE_LIMIT_PER_HOUR: parseInt(import.meta.env?.VITE_RATE_LIMIT_PER_HOUR || '5', 10),

  // Credit to MWK conversion rate
  CONVERSION_RATE: parseInt(import.meta.env?.VITE_CONVERSION_RATE || '100', 10),
} as const;
