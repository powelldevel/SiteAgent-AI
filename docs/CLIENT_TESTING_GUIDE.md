# SiteGent Client Testing Guide

Use this link to test the app:

https://sitegent.vercel.app

## What SiteGent Does

SiteGent helps contractors turn a messy customer message into:

- A job card
- An editable quote in Rand
- An invoice
- A follow-up message for the customer
- A saved job record for signed-in companies
- Quote and invoice exports after saving

Signed-in companies can also add their own prices in the **Pricing** tab. SiteGent will use matched price-list items when preparing quotes.

## Quick Test Steps

1. Open https://sitegent.vercel.app
2. Sign up or sign in.
3. Create your company profile.
4. Open **Pricing** and add a few real prices.
5. Open **Quote Assistant**.
6. Paste a real WhatsApp job message, or use the example message.
7. Click **Generate quote**.
8. Review and edit the quote lines.
9. Read the follow-up message.
10. Click **Save job and invoice**.
11. Open **Saved Jobs**.
12. Click **Open job** and test **Export quote**.
13. Open **Invoices**.
14. Export the saved invoice, copy the payment request, or record the invoice as paid.
15. Open **Settings** and send feedback in **Pilot Feedback**.

## Pilot Rollout

For the first pilot, we are testing with 15 users.

Start with 5 users first.

Do not invite the next 10 until the first 5 can:

- Sign up
- Create a company profile
- Add prices
- Generate a quote
- Save a job
- Export a quote
- Export an invoice
- Send feedback

The app should stay on the free Vercel and Supabase plans for this pilot. Do not upgrade unless the app hits limits or testers cannot use it.

## Important Safety Note

Quote prices must be reviewed. Please check all prices, materials, labour, VAT, delivery fees, and dates before sending anything to a real customer.

For the best pricing test, sign in, create a company profile, open **Pricing**, and add a few real prices first.

## What To Look For

While testing, please check:

- Did the app understand the customer request correctly?
- Are the job title, location, urgency, and phone number useful?
- Are the quote line items realistic enough?
- Is the follow-up message something you would send to a real customer?
- Can you export the quote and invoice?
- Is the payment request useful enough to paste into WhatsApp?
- Is the app easy to understand without help?
- What feels confusing, slow, or missing?

## Account Note

The current public link is ready for workflow testing. For the best test, create an account, create your company profile, add a few real prices, then paste a real WhatsApp job message.

If you only want a quick first look, you can still test:

- Job intake
- Editable quote
- Invoice
- Overall workflow

Exports are only real after you save the job.

## Feedback To Send Back

Please use **Settings > Pilot Feedback** in the app, or reply to the message where you received the SiteGent link and send:

1. Your trade or business type.
2. The type of jobs you usually receive on WhatsApp.
3. One example customer message you would want SiteGent to handle.
4. What worked well.
5. What did not work.
6. What would make you pay for this app.

## Example Test Message

You can paste this into the Quote Assistant:

```text
Hi, I need 6 cubes river sand and 2 cubes 19mm stone delivered to Modimolle before Friday. Please send me a quote. My number is 082 555 0142.
```

Then click **Generate quote**.

## Best Test

The best test is to paste a real message from your own WhatsApp jobs and see whether SiteGent creates a useful job card, quote, invoice, and reply.
