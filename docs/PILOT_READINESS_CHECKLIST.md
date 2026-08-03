# SiteGent Pilot Readiness Checklist

Live app:

https://sitegent.vercel.app

## Current Status

| Checklist item | Status | Notes |
| --- | --- | --- |
| Supabase configured | Done | Vercel production has Supabase URL, publishable key, and server secret key. |
| OpenAI key configured | Done | Vercel production has `OPENAI_API_KEY`. Add OpenAI credits for reliable live AI use. |
| `supabase-schema.sql` run | Done | SQL editor returned `companies already exists`, which means the schema has already created the main tables. |
| One test user can sign up | Done | Production signup creates a session and company profile. |
| One test user can save a job | Done | Live two-user test saved an operation pack for Pilot A. |
| Another test user cannot see that job | Done | Live tenant isolation test passed. Pilot B could not see Pilot A's job. |
| Feedback channel exists | Ready for pilot | Ask testers to reply to the message where you sent them the link, using the feedback questions below. |
| Draft price warning exists | Ready | The app and guide warn users to review prices before sending quotes. |

## What Already Works

- Public app loads.
- Quote extraction works.
- Saved invoice export works after a job is saved.
- Invoice status can be marked sent or paid.
- `/api/health` is live.
- `/api/readiness` returns `200` with production keys configured.
- Supabase Auth and company-scoped saved jobs are connected.
- Live tenant isolation passed: one company cannot see another company's saved job.

## Required Before Wider Real-User Testing

1. Rotate any secrets that were visible in screenshots.
2. Send the client testing guide to 5-15 testers.
3. Collect feedback after each test.
4. Watch for failed signups, failed saves, or wrong prices.

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

Create an account, add 2-3 real prices, then paste one real WhatsApp job message.

Important: quote prices are drafts. Please review all prices before sending anything to a real customer.

After testing, reply with:
1. Did it understand the job?
2. Was the quote useful?
3. Was the invoice useful?
4. What was confusing?
5. Would you pay for this, and why?
```
