import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { recordOperationalEvent } from "@/lib/observability";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

const categorySchema = z.enum(["material", "labour", "delivery", "service", "fee", "other"]);

const priceItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: categorySchema.default("material"),
  unit: z.string().min(1).max(40).default("each"),
  unitPrice: z.number().nonnegative().max(10_000_000),
  vatRate: z.number().min(0).max(1).default(0.15),
  aliases: z.array(z.string().max(80)).max(20).default([]),
  notes: z.string().max(500).optional().nullable(),
  active: z.boolean().default(true),
});

const bulkPriceItemSchema = z.object({
  items: z.array(priceItemSchema).min(1).max(50),
});

const updatePriceItemSchema = priceItemSchema.partial().extend({
  id: z.string().uuid(),
});

const deletePriceItemSchema = z.object({
  id: z.string().uuid(),
});

type PriceItemRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unit_price: number | string;
  vat_rate: number | string;
  aliases: string[] | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

function toClientItem(row: PriceItemRow) {
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
    createdAt: row.created_at,
  };
}

function toDbItem(companyId: string, item: z.infer<typeof priceItemSchema>) {
  return {
    company_id: companyId,
    name: item.name,
    category: item.category,
    unit: item.unit,
    unit_price: item.unitPrice,
    vat_rate: item.vatRate,
    aliases: item.aliases,
    notes: item.notes ?? null,
    active: item.active,
  };
}

async function getPricingClient(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json({
        connected: false,
        message: "Pricing is temporarily unavailable.",
        priceItems: [],
      }),
    };
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return { ok: false as const, response: auth.response };
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 }),
    };
  }

  return { ok: true as const, auth, supabase };
}

export async function GET(request: Request) {
  const limited = rateLimit(`pricing:get:${getRequestKey(request)}`, { limit: 120, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  const context = await getPricingClient(request);

  if (!context.ok) {
    return context.response;
  }

  const { data, error } = await context.supabase
    .from("price_items")
    .select("id,name,category,unit,unit_price,vat_rate,aliases,notes,active,created_at")
    .eq("company_id", context.auth.companyId)
    .order("created_at", { ascending: false });

  if (error) {
    await recordOperationalEvent({
      userId: context.auth.userId,
      companyId: context.auth.companyId,
      route: "/api/pricing",
      action: "api_error",
      status: "failed",
      message: "Price list query failed.",
      metadata: { httpStatus: 500, method: "GET", code: error.code ?? null },
    });
    return NextResponse.json({ connected: true, error: error.message, priceItems: [] }, { status: 500 });
  }

  return NextResponse.json({ connected: true, priceItems: ((data ?? []) as PriceItemRow[]).map(toClientItem) });
}

export async function POST(request: Request) {
  const limited = rateLimit(`pricing:post:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  const context = await getPricingClient(request);

  if (!context.ok) {
    return context.response;
  }

  const body = await request.json();
  const bulkParsed = bulkPriceItemSchema.safeParse(body);

  if (bulkParsed.success) {
    const { data, error } = await context.supabase
      .from("price_items")
      .insert(bulkParsed.data.items.map((item) => toDbItem(context.auth.companyId, item)))
      .select("id,name,category,unit,unit_price,vat_rate,aliases,notes,active,created_at");

    if (error) {
      await recordOperationalEvent({
        userId: context.auth.userId,
        companyId: context.auth.companyId,
        route: "/api/pricing",
        action: "api_error",
        status: "failed",
        message: "Bulk price list import failed.",
        metadata: { httpStatus: 500, method: "POST", code: error.code ?? null },
      });
      return NextResponse.json({ connected: true, error: "Could not import the price list." }, { status: 500 });
    }

    await recordPilotEvent(context.supabase, context.auth.companyId, context.auth.userId, "pricing_configured", {
      itemCount: data?.length ?? 0,
      importType: "bulk",
    });

    return NextResponse.json({
      connected: true,
      priceItems: ((data ?? []) as PriceItemRow[]).map(toClientItem),
      imported: data?.length ?? 0,
    });
  }

  const parsed = priceItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Price item is incomplete.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("price_items")
    .insert(toDbItem(context.auth.companyId, parsed.data))
    .select("id,name,category,unit,unit_price,vat_rate,aliases,notes,active,created_at")
    .single();

  if (error) {
    await recordOperationalEvent({
      userId: context.auth.userId,
      companyId: context.auth.companyId,
      route: "/api/pricing",
      action: "api_error",
      status: "failed",
      message: "Price item creation failed.",
      metadata: { httpStatus: 500, method: "POST", code: error.code ?? null },
    });
    return NextResponse.json({ connected: true, error: error.message }, { status: 500 });
  }

  await recordPilotEvent(context.supabase, context.auth.companyId, context.auth.userId, "pricing_configured", {
    itemCount: 1,
    importType: "single",
  });

  return NextResponse.json({ connected: true, priceItem: toClientItem(data as PriceItemRow) });
}

export async function PATCH(request: Request) {
  const limited = rateLimit(`pricing:patch:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  const context = await getPricingClient(request);

  if (!context.ok) {
    return context.response;
  }

  const parsed = updatePriceItemSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Price item update is incomplete.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
  if (updates.unitPrice !== undefined) dbUpdates.unit_price = updates.unitPrice;
  if (updates.vatRate !== undefined) dbUpdates.vat_rate = updates.vatRate;
  if (updates.aliases !== undefined) dbUpdates.aliases = updates.aliases;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.active !== undefined) dbUpdates.active = updates.active;
  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await context.supabase
    .from("price_items")
    .update(dbUpdates)
    .eq("id", id)
    .eq("company_id", context.auth.companyId)
    .select("id,name,category,unit,unit_price,vat_rate,aliases,notes,active,created_at")
    .single();

  if (error) {
    await recordOperationalEvent({
      userId: context.auth.userId,
      companyId: context.auth.companyId,
      route: "/api/pricing",
      action: "api_error",
      status: "failed",
      message: "Price item update failed.",
      metadata: { httpStatus: 500, method: "PATCH", code: error.code ?? null },
    });
    return NextResponse.json({ connected: true, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connected: true, priceItem: toClientItem(data as PriceItemRow) });
}

export async function DELETE(request: Request) {
  const limited = rateLimit(`pricing:delete:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  const context = await getPricingClient(request);

  if (!context.ok) {
    return context.response;
  }

  const parsed = deletePriceItemSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Price item id is required.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await context.supabase
    .from("price_items")
    .delete()
    .eq("id", parsed.data.id)
    .eq("company_id", context.auth.companyId);

  if (error) {
    await recordOperationalEvent({
      userId: context.auth.userId,
      companyId: context.auth.companyId,
      route: "/api/pricing",
      action: "api_error",
      status: "failed",
      message: "Price item deletion failed.",
      metadata: { httpStatus: 500, method: "DELETE", code: error.code ?? null },
    });
    return NextResponse.json({ connected: true, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connected: true, deleted: true, id: parsed.data.id });
}
