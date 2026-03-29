# Expert Coaching Hub Architecture Notes

## Route protection and security model

This repository is deployed as a Vite React SPA (not a Next.js runtime), so `middleware.ts` is intentionally not part of the runtime enforcement path.

Route gating in the web client is enforced by `ProtectedRoute` for user experience (navigation flow and guard rails). Security enforcement for data access and privileged operations is enforced server-side via Supabase Row Level Security (RLS) and authenticated Supabase Edge Functions.
