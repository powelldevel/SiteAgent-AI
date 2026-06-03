# SiteGent Pilot Readiness Checklist

Live app:

https://sitegent.vercel.app

## Current Status

| Checklist item | Status | Notes |
| --- | --- | --- |
| Supabase configured | Not done | Vercel currently has no environment variables for this project. |
| OpenAI key configured | Not done | Vercel currently has no `OPENAI_API_KEY`. |
| `supabase-schema.sql` run | Not verified | Run the latest schema in your Supabase SQL editor after creating the project. |
| One test user can sign up | Blocked | Requires Supabase env vars and schema. |
| One test user can save a job | Blocked | Requires Supabase env vars and schema. |
| Another test user cannot see that job | Blocked | Run `npm run pilot:check` after Supabase is configured. |
| Feedback channel exists | Ready for pilot | Ask testers to reply to the message where you sent them the link, using the feedback questions below. |
| Draft price warning exists | Ready | The app and guide warn users to review prices before sending quotes. |

## What Already Works

- Public app loads.
- Demo extraction works.
- Quote export works.
- Invoice export works.
- `/api/health` is live.
- `/api/readiness` correctly returns `503` until real production keys are configured.

## Required Before Real Users Save Data

1. Create a Supabase project.
2. Run `supabase-schema.sql` in Supabase SQL editor.
3. Add these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
4. Redeploy Vercel.
5. Confirm https://sitegent.vercel.app/api/readiness returns `200`.
6. Create two pilot accounts.
7. Run `npm run pilot:check`.

## Pilot Feedback Questions

Ask each tester:

1. What trade/business are you in?
2. What type of jobs do customers usually send you on WhatsApp?
3. Did SiteGent understand the job correctly?
4. Was the quote useful?
5. Was the invoice useful?
6. Was the follow-up message something you would send?
7. What was confusing?
8. What would make you pay for this?

## Message To Send Testers

```text
Please test SiteGent here:

https://sitegent.vercel.app

Try Demo Mode first. Then paste one real WhatsApp job message if you are comfortable.

Important: quote prices are drafts. Please review all prices before sending anything to a real customer.

After testing, reply with:
1. Did it understand the job?
2. Was the quote useful?
3. Was the invoice useful?
4. What was confusing?
5. Would you pay for this, and why?
```
