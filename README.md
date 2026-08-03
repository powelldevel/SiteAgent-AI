# SiteGent

SiteGent is a WhatsApp-first operations app for South African contractors. It turns messy customer messages into job cards, editable ZAR quotes, invoices, and follow-up messages.

![SiteGent app preview](docs/sitegent-preview.svg)

## Live Links

- Repo: <https://github.com/powelldevel/SiteGent>
- Live app: <https://sitegent.vercel.app>
- Local: `http://localhost:3000`

## Try It

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, choose an example message or paste a WhatsApp job in **Quote Assistant**, then click **Generate quote**.

### Run with Docker

```bash
docker compose up --build
```

The production-style container runs as a non-root user and exposes `/api/health` for container and load-balancer checks. Add `.env.local` when you want live OpenAI extraction and Supabase persistence; the file is optional for a local demo build.

Production uses OpenAI for extraction and Supabase for private company workspaces. Local development can still run without keys, but saving and live extraction need the configured services.

To verify the basic app flow while the dev server is running:

```bash
npm run demo:check
```

After production keys are configured, use `npm run pilot:check` with two pilot accounts to verify sign-up, onboarding, save, and tenant isolation.

Production checks:

- `/api/health` returns `200` when the app is alive.
- `/api/readiness` returns `200` only after OpenAI and Supabase env vars are configured.

## What It Shows

- WhatsApp job intake
- Job card generation
- Editable quote with VAT and ZAR totals
- Invoice and print-ready document routes
- Supabase Auth sign-up, sign-in, and company onboarding
- Company-scoped saved jobs
- Reproducible standalone container build and GitHub Actions validation
- Versioned extraction prompts, schema-constrained outputs, privacy-safe request telemetry, bounded retries/timeouts, and deterministic fallback behavior
- Offline and live extraction regression suites, including a prompt-injection case

## Architecture

![SiteGent architecture diagram](docs/architecture.svg)

More detail:

- [Client testing guide](docs/CLIENT_TESTING_GUIDE.md)
- [App overview and usage guide](docs/APP_OVERVIEW_AND_USAGE.md)
- [Pilot readiness checklist](docs/PILOT_READINESS_CHECKLIST.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Setup](docs/SETUP.md)
- [Screenshots](docs/SCREENSHOTS.md)
- [Supabase schema](supabase-schema.sql)

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase
- OpenAI Responses API
- Zod

## Environment

Copy `.env.example` to `.env.local` for local development with live services:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
OPENAI_TIMEOUT_MS=20000
OPENAI_MAX_RETRIES=2
SITEGENT_PILOT_ADMIN_EMAILS=you@example.com
```

OpenAI: create an API key in the OpenAI platform and paste it into `OPENAI_API_KEY`.

Supabase: run `supabase-schema.sql`, then paste the Project URL, legacy anon key, and legacy service role key from the Supabase dashboard. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

The Settings screen shows simple service readiness without exposing secret values.

## LLMOps validation

The default CI-safe evaluation exercises the deterministic backup extractor against the same regression contract used by the live model:

```bash
npm run llm:eval
```

With `OPENAI_API_KEY` configured, run the real model gate:

```bash
npm run llm:eval:live
```

Both commands write ignored JSON reports under `artifacts/` with per-case checks, prompt/model versions, latency, and token usage. They do not store customer messages or API keys. The live request path also records a hashed input fingerprint, stable privacy-preserving safety identifier, provider response ID, token counts, latency, fallback reason, and a correlation ID returned as `x-request-id`.

## Status

Public app is live. Real users can create an account, onboard a company, add prices, generate quotes, and save company-scoped jobs. Before broad rollout, add alerting around the existing structured events, database backups, billing, a support process, and a larger labelled extraction evaluation set.
