import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

const quoteItemSchema = z.object({
  description: z.string().min(1).max(180),
  quantity: z.number().positive().max(10000),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
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
    quoteNumber: z.string().min(1).max(80),
    subtotal: z.number().nonnegative(),
    tax: z.number().nonnegative(),
    total: z.number().nonnegative(),
    items: z.array(quoteItemSchema).min(1).max(30),
  }),
});

type IdRow = { id: string };

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

function documentSuffix() {
  return Date.now().toString().slice(-8);
}

export async function POST(request: Request) {
  const limited = rateLimit(`save:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Demo mode: Supabase is not connected yet.",
    });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  const parsed = operationsPackSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Operations pack is incomplete.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const pack = parsed.data;

  try {
    const companyId = auth.companyId;
    const suffix = documentSuffix();

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .insert({
        company_id: companyId,
        name: pack.job.customerName,
        phone: pack.job.phone,
        address: pack.job.location,
      })
      .select("id")
      .single();
    const customer = customerData as IdRow;

    if (customerError) throw new Error(customerError.message);

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .insert({
        company_id: companyId,
        customer_id: customer.id,
        title: pack.job.title,
        description: pack.job.summary,
        location: pack.job.location,
        status: "quoted",
        urgency: pack.job.urgency,
        scheduled_date: dateOrNull(pack.job.estimatedDate),
      })
      .select("id")
      .single();
    const job = jobData as IdRow;

    if (jobError) throw new Error(jobError.message);

    const { error: messageError } = await supabase.from("messages").insert({
      company_id: companyId,
      customer_id: customer.id,
      job_id: job.id,
      channel: "whatsapp",
      direction: "inbound",
      body: pack.originalMessage,
      ai_summary: pack.job.summary,
    });

    if (messageError) throw new Error(messageError.message);

    const { data: quoteData, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        company_id: companyId,
        job_id: job.id,
        quote_number: `SG-Q-${suffix}`,
        subtotal: pack.quote.subtotal,
        tax: pack.quote.tax,
        total: pack.quote.total,
        status: "draft",
      })
      .select("id")
      .single();
    const quote = quoteData as IdRow;

    if (quoteError) throw new Error(quoteError.message);

    const { error: quoteItemsError } = await supabase.from("quote_items").insert(
      pack.quote.items.map((item) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
      })),
    );

    if (quoteItemsError) throw new Error(quoteItemsError.message);

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        company_id: companyId,
        job_id: job.id,
        invoice_number: `SG-I-${suffix}`,
        total: pack.quote.total,
        status: "draft",
        due_date: dueDate(),
      })
      .select("id")
      .single();
    const invoice = invoiceData as IdRow;

    if (invoiceError) throw new Error(invoiceError.message);

    const { error: taskError } = await supabase.from("ai_tasks").insert({
      company_id: companyId,
      job_id: job.id,
      task_type: "job_intake_operations_pack",
      input: {
        message: pack.originalMessage,
        extractionMode: pack.extractionMode,
      },
      output: {
        extractedJob: pack.job,
        quote: pack.quote,
        followUpMessage: pack.job.followUpMessage,
      },
      status: "completed",
    });

    if (taskError) throw new Error(taskError.message);

    return NextResponse.json({
      connected: true,
      message: "Operations pack saved.",
      records: {
        customerId: customer.id,
        jobId: job.id,
        quoteId: quote.id,
        invoiceId: invoice.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: true,
        error: error instanceof Error ? error.message : "Could not save operations pack.",
      },
      { status: 500 },
    );
  }
}
