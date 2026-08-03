import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive().optional(),
  status: z.enum(["pending", "paid", "failed", "refunded"]).default("paid"),
});

type InvoicePaymentRow = {
  id: string;
  total: number | string;
  status: string;
};

export async function POST(request: Request) {
  const limited = rateLimit(`payments:post:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, error: "Payments are temporarily unavailable." }, { status: 503 });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = paymentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ connected: true, error: "Choose a valid invoice payment." }, { status: 400 });
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,total,status")
    .eq("id", parsed.data.invoiceId)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (invoiceError || !invoiceData) {
    return NextResponse.json({ connected: true, error: invoiceError?.message ?? "Invoice not found." }, { status: invoiceError ? 500 : 404 });
  }

  const invoice = invoiceData as InvoicePaymentRow;
  const amount = parsed.data.amount ?? Number(invoice.total ?? 0);

  if (parsed.data.status === "paid" && invoice.status === "paid") {
    return NextResponse.json({
      connected: true,
      alreadyPaid: true,
      message: "Invoice is already marked paid.",
    });
  }

  const { data: paymentData, error: paymentError } = await supabase
    .from("payments")
    .insert({
      company_id: auth.companyId,
      invoice_id: invoice.id,
      amount,
      status: parsed.data.status,
      paid_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
    })
    .select("id,amount,status,paid_at,created_at")
    .single();

  if (paymentError) {
    return NextResponse.json({ connected: true, error: paymentError.message }, { status: 500 });
  }

  if (parsed.data.status === "paid") {
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoice.id)
      .eq("company_id", auth.companyId);

    if (updateError) {
      return NextResponse.json({ connected: true, error: updateError.message }, { status: 500 });
    }
  }

  const { error: eventError } = await supabase.from("ai_tasks").insert({
    company_id: auth.companyId,
    task_type: "payment_recorded",
    input: { invoiceId: invoice.id, status: parsed.data.status, amount },
    output: { payment: paymentData },
    status: "completed",
  });

  if (eventError) {
    console.error("Could not record payment analytics event", eventError);
  }

  return NextResponse.json({
    connected: true,
    message: parsed.data.status === "paid" ? "Payment recorded and invoice marked paid." : "Payment record saved.",
    payment: paymentData,
  });
}
