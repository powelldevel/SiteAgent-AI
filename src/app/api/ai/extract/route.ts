import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { applyCompanyPriceList, extractedJobSchema, inferJobFromMessage } from "@/lib/ai";
import { getAuthContext, getBearerToken, type AuthContext } from "@/lib/auth";
import {
  EXTRACTION_PROMPT_VERSION,
  buildExtractionInput,
  createOpenAIClient,
  getOpenAIModel,
  newLlmRequestId,
  responseTelemetry,
  safeOpenAIError,
  safetyIdentifier,
} from "@/lib/llm";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { recordOperationalEvent } from "@/lib/observability";
import { getSupabaseServerClient, getSupabaseUserClient } from "@/lib/supabase";
import type { ExtractedJob, PriceItem } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 5000;
const DEFAULT_USER_LIMIT = 20;
const DEFAULT_COMPANY_LIMIT = 100;
const DEFAULT_WINDOW_SECONDS = 3600;

type AuthenticatedContext = Extract<AuthContext, { ok: true }>;

type PriceItemRow = {
  id: string;
  name: string;
  category: PriceItem["category"];
  unit: string;
  unit_price: number | string;
  vat_rate: number | string;
  aliases: string[] | null;
  notes: string | null;
  active: boolean;
};

type QuotaResult = {
  allowed: boolean;
  scope: "user" | "company" | null;
  limit: number;
  remaining: number;
  retryAfter: number;
};

function toPriceItem(row: PriceItemRow): PriceItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    vatRate: Number(row.vat_rate),
    aliases: row.aliases ?? [],
    notes: row.notes,
    active: row.active,
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function demoModeEnabled() {
  return process.env.SITEGENT_DEMO_MODE?.trim().toLowerCase() === "true";
}

async function loadCompanyPriceItems(auth: AuthenticatedContext) {
  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("price_items")
    .select("id,name,category,unit,unit_price,vat_rate,aliases,notes,active")
    .eq("company_id", auth.companyId)
    .eq("active", true);

  if (error) {
    return [];
  }

  return ((data ?? []) as PriceItemRow[]).map(toPriceItem);
}

function withCompanyPrices(job: ExtractedJob, priceItems: PriceItem[]) {
  return applyCompanyPriceList(job, priceItems);
}

async function recordQuoteGenerated(auth: AuthenticatedContext, mode: string, job: ExtractedJob) {
  const supabase = getSupabaseUserClient(auth.accessToken);
  if (!supabase) return;

  await recordPilotEvent(supabase, auth.companyId, auth.userId, "quote_generated", {
    mode,
    itemCount: job.quoteItems.length,
  });
}

async function consumeExtractionQuota(auth: AuthenticatedContext) {
  const server = getSupabaseServerClient();

  if (!server) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/ai/extract",
      action: "ai_extraction",
      status: "failed",
      message: "AI quota service is unavailable.",
      metadata: { httpStatus: 503 },
    });
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "AI extraction is temporarily unavailable." },
        { status: 503 },
      ),
    };
  }

  const { data, error } = await server.rpc("consume_ai_extraction_quota", {
    p_user_id: auth.userId,
    p_company_id: auth.companyId,
    p_user_limit: positiveInteger(process.env.AI_EXTRACT_USER_LIMIT, DEFAULT_USER_LIMIT),
    p_company_limit: positiveInteger(process.env.AI_EXTRACT_COMPANY_LIMIT, DEFAULT_COMPANY_LIMIT),
    p_window_seconds: positiveInteger(process.env.AI_EXTRACT_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS),
  });

  if (error || !data) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/ai/extract",
      action: "ai_extraction",
      status: "failed",
      message: "Could not enforce AI extraction quota.",
      metadata: { httpStatus: 503, code: error?.code ?? null },
    });
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "AI extraction is temporarily unavailable." },
        { status: 503 },
      ),
    };
  }

  const quota = data as QuotaResult;

  if (!quota.allowed) {
    const retryAfter = Math.max(1, quota.retryAfter || DEFAULT_WINDOW_SECONDS);
    const message = quota.scope === "company"
      ? "Your company has reached its AI extraction limit. Try again later."
      : "You have reached your AI extraction limit. Try again later.";

    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/ai/extract",
      action: "ai_extraction",
      status: "blocked",
      message: "AI extraction quota exceeded.",
      metadata: { httpStatus: 429, scope: quota.scope },
    });

    return {
      ok: false as const,
      response: NextResponse.json(
        { error: message, limitScope: quota.scope, retryAfter },
        { status: 429, headers: { "retry-after": String(retryAfter) } },
      ),
    };
  }

  return { ok: true as const, quota };
}

function parseMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("message" in payload)) {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export async function POST(request: Request) {
  const llmRequestId = newLlmRequestId();
  const bearerToken = getBearerToken(request);
  const allowAnonymousDemo = !bearerToken && demoModeEnabled();

  let auth: AuthenticatedContext | null = null;

  if (!allowAnonymousDemo) {
    const authResult = await getAuthContext(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    auth = authResult;
  }

  let payload: { message?: string };

  try {
    payload = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a message field." }, { status: 400 });
  }

  const message = parseMessage(payload);

  if (!message?.trim()) {
    return NextResponse.json({ error: "Paste a WhatsApp message or voice-note transcript first." }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message is too long. Keep it under ${MAX_MESSAGE_LENGTH} characters.` }, { status: 413 });
  }

  if (!auth) {
    return NextResponse.json({
      mode: "demo",
      job: withCompanyPrices(inferJobFromMessage(message), []),
      pricing: { matched: false },
      warning: "Demo mode uses sample pricing and does not call OpenAI.",
    });
  }

  const quotaResult = await consumeExtractionQuota(auth);

  if (!quotaResult.ok) {
    return quotaResult.response;
  }

  const priceItems = await loadCompanyPriceItems(auth);

  if (!process.env.OPENAI_API_KEY) {
    const job = withCompanyPrices(inferJobFromMessage(message), priceItems);
    await recordQuoteGenerated(auth, "backup", job);
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/ai/extract",
      action: "ai_extraction",
      status: "fallback",
      level: "warning",
      message: "OpenAI is unavailable; backup extraction was used.",
      metadata: { mode: "backup" },
    });
    return NextResponse.json({
      mode: "backup",
      job,
      pricing: { matched: priceItems.length > 0 },
    }, { headers: { "x-ratelimit-remaining": String(quotaResult.quota.remaining) } });
  }

  try {
    const startedAt = Date.now();
    const client = createOpenAIClient();
    const response = await client.responses.create({
      model: getOpenAIModel(),
      reasoning: { effort: "none" },
      store: false,
      safety_identifier: safetyIdentifier(auth.userId),
      text: {
        format: zodTextFormat(extractedJobSchema, "sitegent_job_extraction"),
      },
      input: buildExtractionInput(message),
    });
    const telemetry = responseTelemetry(response, message, llmRequestId, startedAt);

    const parsed = extractedJobSchema.safeParse(JSON.parse(response.output_text));

    if (!parsed.success) {
      const job = withCompanyPrices(inferJobFromMessage(message), priceItems);
      await recordQuoteGenerated(auth, "fallback", job);
      await recordOperationalEvent({
        userId: auth.userId,
        companyId: auth.companyId,
        route: "/api/ai/extract",
        action: "ai_extraction",
        status: "fallback",
        level: "warning",
        message: "OpenAI response validation failed; fallback extraction was used.",
        metadata: { mode: "fallback", reason: "schema_validation", ...telemetry },
      });
      return NextResponse.json({
        mode: "fallback",
        job,
        warning: "AI response was not valid enough, so SiteGent used the deterministic extractor.",
      }, { headers: {
        "x-ratelimit-remaining": String(quotaResult.quota.remaining),
        "x-request-id": llmRequestId,
        "x-sitegent-ai-mode": "fallback",
      } });
    }

    const job = withCompanyPrices(parsed.data, priceItems);
    await recordQuoteGenerated(auth, "ai", job);
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/ai/extract",
      action: "ai_extraction",
      status: "success",
      message: "AI extraction completed.",
      metadata: { mode: "ai", itemCount: job.quoteItems.length, ...telemetry },
    });
    return NextResponse.json(
      { mode: "ai", job, pricing: { matched: priceItems.length > 0 } },
      { headers: {
        "x-ratelimit-remaining": String(quotaResult.quota.remaining),
        "x-request-id": llmRequestId,
        "x-sitegent-ai-mode": "ai",
      } },
    );
  } catch (error) {
    const job = withCompanyPrices(inferJobFromMessage(message), priceItems);
    await recordQuoteGenerated(auth, "fallback", job);
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/ai/extract",
      action: "ai_extraction",
      status: "fallback",
      level: "error",
      message: "Live AI extraction failed; deterministic fallback used.",
      metadata: {
        mode: "fallback",
        promptVersion: EXTRACTION_PROMPT_VERSION,
        requestId: llmRequestId,
        ...safeOpenAIError(error),
      },
    });
    return NextResponse.json({
      mode: "fallback",
      job,
      pricing: { matched: priceItems.length > 0 },
      warning:
        error instanceof SyntaxError
          ? "AI returned invalid JSON, so SiteGent used the deterministic extractor."
          : "Live AI extraction failed, so SiteGent used the deterministic extractor.",
    }, { headers: {
      "x-ratelimit-remaining": String(quotaResult.quota.remaining),
      "x-request-id": llmRequestId,
      "x-sitegent-ai-mode": "fallback",
    } });
  }
}
