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

Returns record IDs when Supabase is configured, or a demo-mode message when it is not.

## `GET /api/saved-jobs`

Reads recent saved jobs for the dashboard.

## `GET /api/documents/[type]`

Renders print-friendly HTML.

Examples:

- `/api/documents/quote?id=quote-1`
- `/api/documents/invoice?id=invoice-1`

## Hardening

Before production, add auth checks, company scoping, document escaping, and route tests.
