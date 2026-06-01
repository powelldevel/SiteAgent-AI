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

## `GET /api/documents/[type]`

Renders print-friendly HTML.

Examples:

- `/api/documents/quote?id=quote-1`
- `/api/documents/invoice?id=invoice-1`

## Hardening

Before broad production rollout, add invite/team management, billing, document escaping, route tests, backups, and monitoring.
