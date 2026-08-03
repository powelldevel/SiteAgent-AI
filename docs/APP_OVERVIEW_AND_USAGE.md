# SiteGent App Overview and Usage Guide

Live app:

https://sitegent.vercel.app

## What SiteGent Is

SiteGent is an AI operations app for contractors and service businesses that receive job requests through WhatsApp, SMS, calls, or quick customer messages.

It turns an unstructured customer message into a practical operations pack:

- Job card
- Customer details
- Location and urgency
- Quote draft in South African Rand
- Invoice draft
- Follow-up message for the customer
- Saved operations history for signed-in companies

The main idea is simple: a contractor should be able to paste a messy customer message and quickly get the admin work started.

## The Problem It Solves

Many small contractors run their business from WhatsApp. Customers send messages like:

```text
Hi, I need 6 cubes river sand and 2 cubes 19mm stone delivered to Modimolle before Friday. Please send me a quote. My number is 082 555 0142.
```

The contractor then has to manually work out:

- What the customer wants
- Where the job is
- Whether it is urgent
- What line items belong in the quote
- What to reply to the customer
- How to save the job for later
- How to prepare an invoice

SiteGent makes that first admin step faster.

## Who Uses It

SiteGent is built for South African contractors and small service operators, especially businesses that manage jobs manually.

Good early users include:

- Sand, stone, and material delivery businesses
- Plumbers
- Electricians
- Builders
- Handymen
- Maintenance teams
- Small construction contractors
- Local delivery operators
- Owner-run service businesses

The first target user is the owner or admin person who receives job requests, creates quotes, and follows up with customers.

## How The App Works

1. The user opens SiteGent.
2. The user signs in or uses demo mode.
3. The user opens the AI Inbox.
4. The user pastes a customer message or chooses a demo message.
5. SiteGent extracts the job details.
6. SiteGent creates a job card.
7. SiteGent drafts quote line items and totals.
8. SiteGent drafts an invoice.
9. SiteGent creates a customer follow-up message.
10. The user reviews everything.
11. The user can export quote and invoice drafts.
12. Signed-in users can save the operations pack to their company account.

Saved jobs are scoped by company. A user from another company should not be able to see another company's jobs.

## Main Screens

## AI Inbox

This is where the user pastes a customer message and runs extraction.

Use it to:

- Test demo messages
- Paste real customer messages
- Generate a job card
- Generate quote and invoice drafts
- Save an operations pack

## Dashboard

The dashboard shows the current operations picture, including demo workload, quote pipeline, invoices, and saved jobs.

Use it to:

- See recent saved work
- Check whether Supabase is connected
- Review basic business activity

## Quotes

The Quotes view shows quote drafts and export options.

Use it to:

- Review quote totals
- Review VAT and line items
- Export quote documents

Important: quote prices are drafts. Users must review prices, materials, labour, VAT, delivery costs, and dates before sending quotes to real customers.

## Invoices

The Invoices view shows invoice drafts and export options.

Use it to:

- Review invoice information
- Export invoice documents
- Prepare customer-facing paperwork

## Settings

The Settings area handles account and company setup.

Use it to:

- Sign up
- Sign in
- Create a company profile
- Check live service readiness

## How A New User Should Use It

1. Open https://sitegent.vercel.
2. Sign up or sign inapp.
3. Confirm email if Supabase email confirmation is enabled.
4. Create a company profile.
5. Open AI Inbox.
6. Paste a customer job message.
7. Click Run AI extraction.
8. Review the job card.
9. Review the quote draft.
10. Review the invoice draft.
11. Edit or manually adjust anything that looks wrong.
12. Export the quote or invoice if needed.
13. Click Save Operations Pack.

## Simple Client Test

Ask a tester to try this:

```text
Hi, I need 6 cubes river sand and 2 cubes 19mm stone delivered to Modimolle before Friday. Please send me a quote. My number is 082 555 0142.
```

Then ask:

- Did SiteGent understand the job?
- Was the quote useful?
- Was the invoice useful?
- Was the follow-up message useful?
- What was confusing?
- Would you pay for this?

## Current Production Status

The live app is deployed on Vercel:

https://sitegent.vercel.app

Current technical status:

- Supabase is configured.
- OpenAI key is configured.
- The Supabase schema has been run.
- Live readiness returns healthy.
- A two-user privacy test passed.
- User A could save a job.
- User B could not see User A's job.

Known remaining setup items:

- OpenAI billing/credits must be added for reliable real AI extraction.
- Public signup may require email confirmation depending on Supabase Auth settings.
- Secrets shown in screenshots should be rotated before broader launch.
- Monitoring, backups, custom domain, and payment/billing flows are still future production work.

## What SiteGent Is Not Yet

SiteGent is not yet a full accounting system, CRM, payroll system, or final pricing engine.

It does not replace the contractor's judgement. It creates useful drafts faster, but the business owner must still check:

- Final prices
- Material availability
- Labour cost
- Delivery distance
- VAT treatment
- Dates and urgency
- Customer details

## Best Way To Explain It

Short version:

> SiteGent helps contractors turn WhatsApp job requests into job cards, quote drafts, invoice drafts, and customer replies in minutes.

Investor/client version:

> SiteGent is a WhatsApp-first AI operations tool for small contractors. It reduces admin time by converting messy job messages into structured operations packs: job cards, quotes, invoices, and follow-ups. It is built for service businesses that still run on WhatsApp and spreadsheets.

## Pilot Goal

The goal of the first pilot is not perfection. The goal is to learn whether real contractors find the workflow useful enough to keep using.

The best pilot questions are:

- Does this save time?
- Does it understand real job messages?
- Are the quote drafts close enough to be useful?
- Would users trust it after reviewing the output?
- What must be added before they would pay?

