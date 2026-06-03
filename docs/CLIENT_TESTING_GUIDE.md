# SiteGent Client Testing Guide

Use this link to test the app:

https://sitegent.vercel.app

## What SiteGent Does

SiteGent helps contractors turn a messy customer message into:

- A job card
- A quote draft in Rand
- An invoice draft
- A follow-up message for the customer

## Quick Test Steps

1. Open https://sitegent.vercel.app
2. Click **Run founder demo** or **Demo Mode**.
3. Open **AI Inbox** if it is not already open.
4. Choose one demo message, for example **Sand delivery**.
5. Click **Run AI extraction**.
6. Review the generated job details.
7. Check the quote total and line items.
8. Read the follow-up message.
9. Click **Export Quote**.
10. Click **Export Invoice**.

## Important Safety Note

Quote prices are drafts. Please review all prices, materials, labour, VAT, delivery fees, and dates before sending anything to a real customer.

## What To Look For

While testing, please check:

- Did the app understand the customer request correctly?
- Are the job title, location, urgency, and phone number useful?
- Are the quote line items realistic enough?
- Is the follow-up message something you would send to a real customer?
- Is the app easy to understand without help?
- What feels confusing, slow, or missing?

## Demo Mode Note

The current public link is safe for testing the workflow. Some features may still be in demo mode until live OpenAI and Supabase keys are fully configured.

If saving is not active yet, you can still test:

- AI job intake
- Quote draft
- Invoice draft
- Export quote
- Export invoice
- Overall workflow

## Feedback To Send Back

Please reply to the message where you received the SiteGent link and send:

1. Your trade or business type.
2. The type of jobs you usually receive on WhatsApp.
3. One example customer message you would want SiteGent to handle.
4. What worked well.
5. What did not work.
6. What would make you pay for this app.

## Example Test Message

You can paste this into the AI Inbox:

```text
Hi, I need 6 cubes river sand and 2 cubes 19mm stone delivered to Modimolle before Friday. Please send me a quote. My number is 082 555 0142.
```

Then click **Run AI extraction**.

## Best Test

The best test is to paste a real message from your own WhatsApp jobs and see whether SiteGent creates a useful job card, quote, invoice, and reply.
