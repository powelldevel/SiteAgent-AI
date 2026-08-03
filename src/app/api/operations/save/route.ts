import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { recordOperationalEvent } from "@/lib/observability";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";
import { calculateVatTotals, DEFAULT_VAT_RATE, roundMoney } from "@/lib/vat";

const quoteItemSchema = z.object({
  description: z.string().min(1).max(180),
  quantity: z.number().positive().max(10000),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
  pricingSource: z.enum(["company_price_list", "ai_estimate", "manual"]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  pricingStatus: z.enum(["matched", "estimated", "needs_review"]).optional(),
});

const operationsPackSchema = z.object({
  originalMessage: z.string().min(1).max(5000),
  extractionMode: z.string().min(1),
  job: z.object({
    customerName: z.string().min(1).max(120),
    phone: z.string().min(1).max(40),
    location: z.string().min(1).max(220),
    jobType: z.string().min(1).max(80),
    title: z.string().min(1).max(180),
    materials: z.array(z.string().max(120)).max(20),
    estimatedDate: z.string().min(1).max(80),
    urgency: z.enum(["low", "medium", "high"]),
    missingDetails: z.array(z.string().max(180)).max(20),
    summary: z.string().min(1).max(1200),
    quoteItems: z.array(quoteItemSchema).min(1).max(30),
    followUpMessage: z.string().min(1).max(1200),
  }),
  quote: z.object({
    quoteNumber: z.string().max(80).optional(),
    subtotal: z.number().nonnegative(),
    tax: z.number().nonnegative(),
    total: z.number().nonnegative(),
    items: z.array(quoteItemSchema).min(1).max(30),
  }),
});

function normalizeQuoteItems(items: z.infer<typeof quoteItemSchema>[]) {
  return items.map((item) => ({
    ...item,
    total: roundMoney(item.quantity * item.unitPrice),
  }));
}

function dateOrNull(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

function dueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const limited = rateLimit(`save:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    await recordOperationalEvent({
      route: "/api/operations/save",
      action: "save_operations_pack",
      status: "blocked",
      message: "Save rate limit exceeded.",
      metadata: { httpStatus: 429 },
    });
    return limited;
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Saving is temporarily unavailable.",
    });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/operations/save",
      action: "save_operations_pack",
      status: "failed",
      message: "Supabase user client is unavailable.",
      metadata: { httpStatus: 500 },
    });
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  const parsed = operationsPackSchema.safeParse(await request.json());

  if (!parsed.success) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/operations/save",
      action: "save_operations_pack",
      status: "failed",
      message: "Save payload validation failed.",
      metadata: { httpStatus: 400 },
    });
    return NextResponse.json({ error: "Job record is incomplete.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const pack = parsed.data;

  try {
    const normalizedItems = normalizeQuoteItems(pack.quote.items);
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("vat_registered,vat_rate")
      .eq("id", auth.companyId)
      .maybeSingle();

    if (companyError || !companyData) {
      throw new Error("Could not load the company VAT settings.");
    }

    const company = companyData as { vat_registered: boolean; vat_rate: number | string };
    const totals = calculateVatTotals(normalizedItems, {
      vatRegistered: company.vat_registered,
      vatRate: Number(company.vat_rate ?? DEFAULT_VAT_RATE),
    });
    const normalizedQuote = {
      ...totals,
      items: normalizedItems,
    };
    const { data, error } = await supabase.rpc("save_operations_pack", {
      p_original_message: pack.originalMessage,
      p_extraction_mode: pack.extractionMode,
      p_job: pack.job,
      p_quote: normalizedQuote,
      p_subtotal: totals.subtotal,
      p_tax: totals.tax,
      p_total: totals.total,
      p_scheduled_date: dateOrNull(pack.job.estimatedDate),
      p_due_date: dueDate(),
    });

    if (error) {
      const httpStatus = error.code === "23505" ? 409
        : error.code === "42501" ? 403
          : ["22P02", "23502", "23503", "23514"].includes(error.code) ? 400
            : 500;

      await recordOperationalEvent({
        userId: auth.userId,
        companyId: auth.companyId,
        route: "/api/operations/save",
        action: "save_operations_pack",
        status: "failed",
        message: "Database transaction rejected the save.",
        metadata: { httpStatus, code: error.code },
      });

      if (error.code === "23505") {
        return NextResponse.json(
          {
            connected: true,
            error: "This quote has already been saved. Refresh saved jobs before saving again.",
          },
          { status: 409 },
        );
      }

      if (error.code === "42501") {
        return NextResponse.json(
          {
            connected: true,
            error: "Create your company profile before saving jobs.",
          },
          { status: 403 },
        );
      }

      if (["22P02", "23502", "23503", "23514"].includes(error.code)) {
        return NextResponse.json(
          {
            connected: true,
            error: "The job contains invalid or incomplete data. Review it and try again.",
          },
          { status: 400 },
        );
      }

      throw new Error("Database transaction failed.");
    }

    const savedTotals = {
      subtotal: Number(data.subtotal ?? totals.subtotal),
      tax: Number(data.tax ?? totals.tax),
      total: Number(data.total ?? totals.total),
      vatRegistered: Boolean(data.vatRegistered ?? totals.vatRegistered),
      vatRate: Number(data.vatRate ?? totals.vatRate),
    };

    await recordPilotEvent(supabase, auth.companyId, auth.userId, "job_saved", {
      total: savedTotals.total,
      quoteNumber: data.quoteNumber,
      invoiceNumber: data.invoiceNumber,
    });
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/operations/save",
      action: "save_operations_pack",
      status: "success",
      message: "Operations pack saved.",
      metadata: { quoteNumber: data.quoteNumber, invoiceNumber: data.invoiceNumber },
      persist: false,
    });

    return NextResponse.json({
      connected: true,
      message: "Job, quote, and invoice saved together.",
      records: { ...data, ...savedTotals },
    });
  } catch (error) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/operations/save",
      action: "save_operations_pack",
      status: "failed",
      message: error instanceof Error ? error.message : "Could not save operations pack.",
      metadata: { httpStatus: 500 },
    });
    return NextResponse.json(
      {
        connected: true,
        error: error instanceof Error ? error.message : "Could not save operations pack.",
      },
      { status: 500 },
    );
  }
}
