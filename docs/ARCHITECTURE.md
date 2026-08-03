# Architecture

![SiteGent architecture diagram](architecture.svg)

## Flow

1. User pastes a WhatsApp message in the browser app.
2. `/api/ai/extract` extracts job details with OpenAI or the local demo extractor.
3. The UI creates a job card, quote draft, invoice draft, and follow-up message.
4. `/api/documents/[type]` renders print-ready quote/invoice HTML.
5. `/api/operations/save` saves the pack to Supabase when configured.
6. `/api/saved-jobs` reads recent jobs for the dashboard.

## Core Files

| Area | File |
| --- | --- |
| App UI | `src/app/page.tsx` |
| AI schema and fallback | `src/lib/ai.ts` |
| LLM client, prompt version, safety and telemetry | `src/lib/llm.ts` |
| Offline/live evaluation suite | `scripts/llm-eval.mts`, `evals/sitegent-extraction.json` |
| AI route | `src/app/api/ai/extract/route.ts` |
| Save route | `src/app/api/operations/save/route.ts` |
| Saved jobs | `src/app/api/saved-jobs/route.ts` |
| Documents | `src/app/api/documents/[type]/route.ts` |
| Schema | `supabase-schema.sql` |

## Production Notes

- Add team invites and role management before multi-person companies.
- Add alerting, dashboards, backups, and billing before broad production rollout.
- Grow the labelled LLM evaluation set from regression coverage into representative pilot traffic slices before changing prompts or models.
- Escape dynamic content in document HTML.
