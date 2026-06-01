# Setup

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Mode

The app runs without external services:

- No OpenAI key: local demo extractor
- No Supabase keys: save action shows demo-mode message

## Optional `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SITEGENT_DEMO_COMPANY_ID=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
```

Copy `.env.example` to `.env.local`, then fill in only the services you want to test live. Empty values keep the app in local demo mode.

## OpenAI

Create an API key in the OpenAI platform and paste it into `.env.local`:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
```

Restart `npm run dev` after changing `.env.local`. The Settings screen shows whether the app sees the key.

## Supabase

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the SQL editor.
3. Open Project Settings, then API Keys.
4. Copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`.
5. Copy the legacy `anon` key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Copy the legacy `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not put it in browser code, screenshots, commits, or public demos.

## Real Users

After Supabase is configured, users can sign up from the Settings screen, create their company profile, and save real operations packs. API routes require a Supabase access token and scope saved jobs to the authenticated user's `company_id`.

For a first pilot, keep sign-ups controlled by sharing the URL only with selected contractors. For broader launch, add billing, team invites, email templates, database backups, and monitoring.

## Checks

```bash
npm run lint
npm run build
npm run demo:check
```

`npm run demo:check` expects the dev server to be running at `http://127.0.0.1:3000`. Set `SITEGENT_URL` to check a different URL. The Settings screen also has a live-services checklist.

## Deploy

Import the repo into Vercel, add environment variables, deploy `main`, then add the live URL to the README.
