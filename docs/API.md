# API

## `POST /api/ai/extract`

Extracts a job from a pasted message.

```json
{ "message": "Need 6 cubes river sand delivered before Friday in Modimolle." }
```

Returns:

```json
{
  "mode": "demo",
  "job": {
    "customerName": "Customer",
    "location": "Modimolle",
    "jobType": "Delivery",
    "title": "Delivery job in Modimolle",
    "urgency": "medium",
    "quoteItems": []
  }
}
```

Modes: `ai`, `demo`, or `fallback`.

## `POST /api/operations/save`

Saves the generated customer, message, job, quote, invoice, and AI audit record to Supabase.

Returns record IDs when Supabase is configured and the request includes a valid bearer token. Returns a demo-mode message when Supabase is not configured.

## `GET /api/saved-jobs`

Reads recent saved jobs for the dashboard.

When Supabase is configured, this route requires a valid bearer token and only returns jobs for the authenticated user's company.

## `GET /api/auth/me`

Returns the signed-in user's company profile.

## `POST /api/auth/onboard`

Creates the signed-in user's company and owner profile after first sign-up.

## `GET /api/health`

Returns `200` when the app process is alive.

## `GET /api/readiness`

Returns `200` only when OpenAI and Supabase server/user-client environment variables are configured. Returns `503` while the app is still in demo/unconfigured mode.

## `GET /api/documents/[type]`

Renders print-friendly HTML.

Examples:

- `/api/documents/quote?id=quote-1`
- `/api/documents/invoice?id=invoice-1`

## Hardening

Current API guardrails include auth-required saved-job routes when Supabase is configured, RLS-enforced company-scoped reads/writes, request size limits, health/readiness endpoints, and lightweight per-instance throttling. Before broad production rollout, add invite/team management, billing, durable distributed rate limiting, document escaping, backups, and monitoring.
