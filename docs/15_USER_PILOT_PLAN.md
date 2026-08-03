# SiteGent 15 User Pilot Plan

Live app:

https://sitegent.vercel.app

## Goal

Test SiteGent with 15 real contractors or admin users before paying for bigger hosting plans.

For this pilot, keep:

- Vercel on the free Hobby plan.
- Supabase on the free plan.
- OpenAI funded with a small credit balance.

Do not upgrade Vercel or Supabase unless the app hits limits or testers cannot use it.

## Current Status

The app is ready for a small pilot.

Passed checks:

- Live app loads.
- OpenAI extraction works.
- Supabase is connected.
- A user can sign up.
- A user can add prices.
- A user can save a job.
- A user can export a quote.
- A user can export an invoice.
- A user can record payment.
- A user can send feedback.
- Another company cannot see that user's jobs or invoices.

## Phase 1: Invite 5 Users First

Send the first invite to only 5 people.

Choose people who:

- Receive job requests on WhatsApp.
- Make quotes manually.
- Can give honest feedback.
- Will test with at least one real job message.

## Invite Message

Copy and send this:

```text
Hi, I’m testing SiteGent, a simple app that turns WhatsApp job messages into editable quotes, job cards, invoices, and follow-up messages.

Please test it here:
https://sitegent.vercel.app

Please try:
1. Create an account.
2. Create your company profile.
3. Add 3 to 5 real prices in Pricing.
4. Paste a real WhatsApp job message.
5. Generate a quote.
6. Save the job and invoice.
7. Open Saved Jobs and export the quote.
8. Open Invoices and export the invoice.
9. Send feedback in Settings.

Important: do not send the quote to a real customer without checking the prices first. SiteGent creates drafts, not final prices.
```

## What To Watch

For each tester, check whether they can complete these steps:

- Sign up or sign in.
- Create company profile.
- Add prices.
- Generate quote.
- Understand which quote lines need review.
- Save job and invoice.
- Open saved job.
- Export quote.
- Export invoice.
- Copy payment request or record payment.
- Send feedback.

## Stop And Fix If

Pause the pilot if 2 or more of the first 5 users have the same issue.

Fix before inviting more users if:

- They cannot sign up.
- They do not understand that prices must be added first.
- They do not understand the quote is a draft.
- They cannot find Saved Jobs.
- They cannot export quote or invoice.
- The app shows repeated errors.
- The quote output is too confusing to review.

## Phase 2: Invite The Next 10 Users

Only invite the next 10 after the first 5 can complete the main flow.

Before inviting the next 10:

- Review Pilot Feedback in Settings.
- Check Pilot Signals in Settings.
- Run:

```bash
npm run pilot:check
```

If the check passes and feedback is not repeating the same major issue, invite the next 10.

## What Success Looks Like

The 15-user pilot is successful if:

- At least 10 of 15 users generate a quote.
- At least 7 of 15 users save a job.
- At least 5 of 15 users export a quote or invoice.
- At least 5 users send useful feedback.
- At least 3 users say they would use this again for real jobs.

## Cost Rule

Stay on free Vercel and free Supabase for this pilot.

Upgrade only if:

- Supabase pauses or hits limits.
- Vercel hits limits.
- The app becomes slow for testers.
- You are ready to invite more than 15 users.

OpenAI is the only expected pilot cost. Keep a small credit balance and watch usage.
