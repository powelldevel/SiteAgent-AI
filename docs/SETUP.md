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

## Supabase

Run `supabase-schema.sql` in the Supabase SQL editor, then add the Supabase environment variables.

## Checks

```bash
npm run lint
npm run build
```

Production builds fetch Google Fonts through `next/font/google`, so network access is required.

## Deploy

Import the repo into Vercel, add environment variables, deploy `main`, then add the live URL to the README.
