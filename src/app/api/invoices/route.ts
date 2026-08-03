import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

const invoiceStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "sent", "paid", "overdue"]),
});

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total: number | string;
  status: "draft" | "sent" | "paid" | "overdue";
  due_date: string | null;
  created_at: string;
  jobs?: {
    title?: string | null;
    customers?: {
      name?: string | null;
    } | null;
  } | null;
};

function toInvoice(row: InvoiceRow) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    total: Number(row.total ?? 0),
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    jobTitle: row.jobs?.title ?? "Saved job",
    customerName: row.jobs?.customers?.name ?? null,
  };
}

export async function GET(request: Request) {
  const limited = rateLimit(`invoices:get:${getRequestKey(request)}`, { limit: 120, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, message: "Invoices are temporarily unavailable.", invoices: [] });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing.", invoices: [] }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      total,
      status,
      due_date,
      created_at,
      jobs(title, customers(name))
    `,
    )
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ connected: true, error: error.message, invoices: [] }, { status: 500 });
  }

  return NextResponse.json({ connected: true, invoices: ((data ?? []) as InvoiceRow[]).map(toInvoice) });
}

export async function PATCH(request: Request) {
  const limited = rateLimit(`invoices:patch:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, error: "Invoices are temporarily unavailable." }, { status: 503 });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  const parsed = invoiceStatusSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ connected: true, error: "Choose a valid invoice status." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("company_id", auth.companyId)
    .select(
      `
      id,
      invoice_number,
      total,
      status,
      due_date,
      created_at,
      jobs(title, customers(name))
    `,
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ connected: true, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ connected: true, error: "Invoice not found." }, { status: 404 });
  }

  return NextResponse.json({ connected: true, invoice: toInvoice(data as InvoiceRow) });
}
