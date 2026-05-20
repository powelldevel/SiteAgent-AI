# SiteGent

SiteGent is an AI-native operations manager for South African contractors and field-service businesses that still run on WhatsApp, voice notes, paper, and spreadsheets.

The MVP wedge is intentionally narrow:

1. Paste a messy customer request or voice-note transcript.
2. AI extracts the job details.
3. SiteGent creates a job card, quote, PDF-ready document, invoice, and follow-up message.

## Stack

- Next.js App Router
- Tailwind CSS
- Supabase Auth, Postgres, and Storage
- OpenAI API
- Browser print/PDF route for first document generation pass

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SITEGENT_DEMO_COMPANY_ID=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
```

Without `OPENAI_API_KEY`, the app runs in demo mode with a deterministic extractor so pilots and UI demos still work.
Without `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, saving stays in demo mode and shows: `Demo mode: Supabase is not connected yet.`

`SITEGENT_DEMO_COMPANY_ID` is optional. If omitted, the save route uses the first company in Supabase or creates `Mokoena Build & Maintenance`.

## Database

Run [supabase-schema.sql](/C:/Users/Kgotso%20Powell/Desktop/SiteGent/supabase-schema.sql) in Supabase SQL editor. It includes the MVP tables and company-level row security policies:

- users
- companies
- customers
- workers
- jobs
- quotes
- quote_items
- invoices
- messages
- payments
- ai_tasks

## Routes

- `/` - SiteGent MVP app shell
- `/api/ai/extract` - Extract job JSON from a pasted WhatsApp message
- `/api/operations/save` - Save the generated operations pack to Supabase
- `/api/saved-jobs` - Read saved Supabase jobs for the dashboard
- `/api/documents/quote?id=quote-1` - PDF-ready quote
- `/api/documents/invoice?id=invoice-1` - PDF-ready invoice

## Next Production Steps

- Add Supabase Auth screens and protected route checks.
- Move server-side demo persistence behind authenticated company sessions.
- Generate true PDFs with Playwright or a server document worker and upload them to Supabase Storage.
- Add WhatsApp Business API once the simulated inbox workflow wins with pilot users.
