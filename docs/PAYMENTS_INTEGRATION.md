Overview

This document describes the environment variables, deployment steps, and MCP recommendations required to run the PayChangu + Supabase billing integration implemented in this repo. It covers Edge Function deployment, webhook setup, test flows, and Builder preview behavior.

Required environment variables

- SUPABASE_URL — Your Supabase project URL (ex: https://xyzcompany.supabase.co). Used by edge functions and client.
- SUPABASE_PUBLISHABLE_KEY — Public anon key used by the client (already in repo). Keep for frontend.
- SUPABASE_SERVICE_ROLE_KEY — Service role key (server-side only). Required to run Supabase Edge Functions that modify DB and read privileged data. Store as a secret in Supabase Functions and CI.
- PAYCHANGU_SECRET_KEY — PayChangu secret/API key used to create payment links. Store only server-side (Supabase Functions or your server provider).
- PAYCHANGU_WEBHOOK_SECRET — Secret used to verify webhook HMAC signatures from PayChangu. Store server-side and configure in PayChangu dashboard.
- PAYCHANGU_DEFAULT_CURRENCY — (optional) e.g. "USD" or "MWK". Defaults to MWK in functions when not provided.
- PAYCHANGU_WEBHOOK_URL — (optional) The public URL PayChangu should POST webhooks to. If omitted, we default to the Supabase Functions route: <SUPABASE_URL>/functions/v1/paychangu-webhook
- APP_BASE_URL — The public URL of your application (https://yourapp.example). Used as return_url after checkout and in email links.

Where to set these

- Supabase Edge Functions: In the Supabase dashboard go to Project -> Functions -> Secrets and set SUPABASE_SERVICE_ROLE_KEY, PAYCHANGU_SECRET_KEY, PAYCHANGU_WEBHOOK_SECRET, PAYCHANGU_DEFAULT_CURRENCY, APP_BASE_URL.
- Frontend/Hosting (Netlify/Vercel/Host): Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY as public environment variables on the host. Do NOT expose service role keys on the client.

Edge Functions to deploy

Files created in this repo (supabase/functions):
- create-payment-link
- paychangu-webhook
- get-user-purchase-history

Deploy commands (Supabase CLI)

1. Install/authorize supabase CLI and login.
2. From repository root run:
   supabase functions deploy create-payment-link
   supabase functions deploy paychangu-webhook
   supabase functions deploy get-user-purchase-history

After deploy, the functions will be available under:
  https://<YOUR_SUPABASE_PROJECT>.functions.supabase.co/<function-name>

PayChangu webhook configuration

1. In PayChangu dashboard (Developer/API Keys & Webhooks): set your Webhook URL to your deployed paychangu-webhook function URL.
2. Ensure PayChangu is configured to send the signature header (the code expects the header named `Signature`).
3. Set PAYCHANGU_WEBHOOK_SECRET in Supabase to the same secret used by PayChangu.

Signature validation

- The webhook implementation computes HMAC-SHA256 over the raw request body using PAYCHANGU_WEBHOOK_SECRET and compares to the Signature header. Keep secrets safe and ensure your endpoint receives raw body (no middleware that re-encodes JSON before signature check).

Testing flows

- Create payment: client calls supabase.functions.invoke('create-payment-link') which creates DB records (pending) and calls PayChangu to generate a checkout_url. The response includes checkout_url and a transaction_ref.
- Complete payment: PayChangu will POST the webhook to paychangu-webhook which verifies signature and updates transactions, orders, subscriptions, and invoices accordingly.
- Purchase history: client calls supabase.functions.invoke('get-user-purchase-history') to fetch invoices, orders, subscriptions, transactions for the logged-in user.

Local development & Builder preview

- Builder.io preview or environments that cannot reach Supabase/PayChangu must not call server-side secrets. For Builder previews this repo includes a Builder shim (src/lib/builderPreview.ts) and the billing pages use mock data when Builder preview is detected.
- For local end-to-end testing (real gateway/webhooks), you can expose your local server or function endpoint using a tunneling tool (ngrok, localtunnel) and set PAYCHANGU_WEBHOOK_URL to the public tunnel URL.

Security notes

- Never store or expose SUPABASE_SERVICE_ROLE_KEY or PAYCHANGU_SECRET_KEY in client-side code, public repos, or Builder preview. Use Supabase function secrets or host provider secrets.
- Validate webhook signatures strictly and log suspicious requests for investigation.

MCP (Integrations) recommendations

Available/Recommended MCP servers (all are available options in Builder.io integrations):
- Supabase — Recommended first. Use for DB, auth, edge functions and storage. (Click [Connect to Supabase](#open-mcp-popover)).
- Neon — Alternative serverless Postgres option. (Click [Connect to Neon](#open-mcp-popover)).
- Netlify — Host frontend and set environment variables / serverless functions. (Click [Connect to Netlify](#open-mcp-popover)).
- Zapier — Useful for automation e.g., send invoices to external systems, notifications. (Click [Connect to Zapier](#open-mcp-popover)).
- Figma — Designer workflow; use Builder’s Figma plugin to convert designs. (Get Figma plugin via MCP manager or plugin link.)
- Builder CMS — Manage content, pages, and assets inside Builder. (Click [Connect to Builder.io](#open-mcp-popover)).
- Linear — Project management / issue tracking integration. (Click [Connect to Linear](#open-mcp-popover)).
- Notion — Documentation and knowledge base integration. (Click [Connect to Notion](#open-mcp-popover)).
- Sentry — Error logging and production monitoring for webhooks and edge functions. (Click [Connect to Sentry](#open-mcp-popover)).
- Context7 — Up-to-date docs for libraries and frameworks; helpful when implementing payments securely. (Click [Connect to Context7](#open-mcp-popover)).
- Semgrep — Static security scanning for your codebase (SAST). (Click [Connect to Semgrep](#open-mcp-popover)).
- Prisma Postgres — If you prefer Prisma as ORM over direct Supabase DB access. (Click [Connect to Prisma](#open-mcp-popover)).

Notes on MCP usage

- Prefer Supabase for DB/auth and edge functions. Use Netlify/Vercel/Host to host frontend and set env vars. Use Sentry & Semgrep for monitoring and security scanning. Use Builder CMS for content management.
- To connect any of these MCP servers in Builder, open the MCP popover and follow the provider-specific connection flow: e.g., Click [Connect to Supabase](#open-mcp-popover).

What I changed in this repo

- Supabase Edge Functions: create-payment-link, paychangu-webhook, get-user-purchase-history (supabase/functions/*)
- Frontend hooks: src/hooks/usePayments.ts (calls functions.invoke)
- Billing pages: src/pages/coach/Billing.tsx and src/pages/client/Billing.tsx (with Builder preview mock shim)
- Builder preview detection helper: src/lib/builderPreview.ts

Next actions (choose one)

- I can finalize a deployment guide (step-by-step CLI commands + environment set screenshots) and help you perform the deployment if you grant access or provide the SUPABASE_SERVICE_ROLE_KEY and PayChangu test keys.
- I can add CI/CD examples (GitHub Actions / Netlify) to deploy functions automatically on push.

If you want me to proceed with a deployment guide or CI examples, reply with which provider you plan to use for hosting (Netlify, Vercel, Supabase Functions, or other).
