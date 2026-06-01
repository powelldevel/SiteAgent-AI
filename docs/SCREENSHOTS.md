# Screenshots

## Preview

![SiteGent app preview](sitegent-preview.svg)

## Architecture

![SiteGent architecture diagram](architecture.svg)

## Demo Script

1. Open the app.
2. Click **Demo Mode**.
3. Open **AI Inbox**.
4. Click **Run AI extraction**.
5. Review the generated job card, quote, invoice, and follow-up message.
6. Export the quote or invoice.

## Preflight

With the dev server running:

```bash
npm run demo:check
```

The check validates the home page, extraction endpoint, saved-jobs endpoint, and quote/invoice document routes.

Add real browser screenshots here after deployment:

- `dashboard.png`
- `ai-inbox.png`
- `quote-draft.png`
- `mobile.png`
