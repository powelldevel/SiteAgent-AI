import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { recordOperationalEvent } from "@/lib/observability";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { getSupabaseUserClient } from "@/lib/supabase";

type DocumentItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type RealInvoiceRow = {
  id: string;
  invoice_number: string;
  total: number | string;
  status: string;
  due_date: string | null;
  created_at: string;
  companies?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  jobs?: {
    title?: string | null;
    description?: string | null;
    location?: string | null;
    customers?: {
      name?: string | null;
      phone?: string | null;
      address?: string | null;
    } | null;
    quotes?: {
      subtotal?: number | string | null;
      tax?: number | string | null;
      total?: number | string | null;
      vat_registered?: boolean | null;
      vat_rate?: number | string | null;
      quote_items?: {
        description: string;
        quantity: number | string;
        unit_price: number | string;
        total: number | string;
      }[];
    }[];
  } | null;
};

type RealQuoteRow = {
  id: string;
  quote_number: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  vat_registered: boolean;
  vat_rate: number | string;
  status: string;
  created_at: string;
  companies?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  jobs?: {
    title?: string | null;
    description?: string | null;
    location?: string | null;
    customers?: {
      name?: string | null;
      phone?: string | null;
      address?: string | null;
    } | null;
  } | null;
  quote_items?: {
    description: string;
    quantity: number | string;
    unit_price: number | string;
    total: number | string;
  }[];
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function renderDocument(input: {
  title: "Quote" | "Invoice";
  number: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  companyInfo: { name: string; phone: string; email: string; address: string };
  customerInfo: { name: string; phone: string; address: string };
  jobTitle: string;
  jobDescription: string;
  items: DocumentItem[];
  subtotal: number;
  tax: number;
  total: number;
  vatRegistered: boolean;
  vatRate: number;
}) {
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(input.title)} ${escapeHtml(input.number)}</title>
      <style>
        * { box-sizing: border-box; }
        html, body { max-width: 100%; overflow-x: hidden; }
        body { max-width: 920px; font-family: Arial, sans-serif; color: #111827; margin: 28px auto; padding: 0 18px; }
        .top { display: flex; justify-content: space-between; gap: 28px; border-bottom: 3px solid #166534; padding: 18px 0 24px; flex-wrap: wrap; }
        h1 { margin: 0; font-size: clamp(30px, 10vw, 42px); letter-spacing: -1px; }
        h2 { margin: 0 0 8px; font-size: 18px; }
        p { line-height: 1.55; }
        .muted { color: #6b7280; }
        .document-meta { display: grid; grid-template-columns: repeat(2, minmax(130px, 1fr)); gap: 8px 20px; min-width: 280px; }
        .meta-label { color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .meta-value { font-size: 14px; font-weight: 700; }
        .party-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 26px; }
        .party { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .status { display: inline-block; margin-top: 10px; border: 1px solid #fde68a; border-radius: 999px; background: #fffbeb; color: #92400e; padding: 5px 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 32px; table-layout: fixed; }
        th { text-align: left; background: #f0fdf4; color: #166534; font-size: 12px; text-transform: uppercase; }
        th, td { padding: 12px; border-bottom: 1px solid #e5e7eb; overflow-wrap: anywhere; }
        .right { text-align: right; }
        .totals { width: min(100%, 340px); margin: 22px 0 0 auto; border-radius: 8px; background: #111827; color: white; padding: 16px; }
        .total-row { display: flex; justify-content: space-between; gap: 20px; margin-top: 6px; }
        .grand-total { border-top: 1px solid #4b5563; margin-top: 12px; padding-top: 12px; font-size: 22px; font-weight: 800; }
        .terms { margin-top: 28px; border: 1px solid #fde68a; border-radius: 8px; background: #fffbeb; color: #78350f; padding: 14px; font-size: 13px; }
        .footer { margin-top: 42px; padding-top: 18px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        button { min-height: 44px; border: 0; border-radius: 6px; background: #111827; color: white; padding: 0 16px; font-weight: 700; }
        @media (max-width: 430px) {
          body { margin: 14px; font-size: 14px; }
          .top { gap: 16px; padding-bottom: 18px; }
          .document-meta, .party-grid { grid-template-columns: 1fr; min-width: 0; }
          table, thead, tbody, tr, th, td { display: block; width: 100%; }
          thead { display: none; }
          tr { border-bottom: 1px solid #dce5df; padding: 10px 0; }
          td { display: flex; justify-content: space-between; gap: 12px; border-bottom: 0; padding: 6px 0; text-align: right; }
          td::before { color: #66736d; font-weight: 700; text-align: left; }
          td:nth-child(1)::before { content: "Description"; }
          td:nth-child(2)::before { content: "Qty"; }
          td:nth-child(3)::before { content: "Unit"; }
          td:nth-child(4)::before { content: "Total"; }
          .grand-total { font-size: 20px; }
        }
        @media print { body { margin: 24px; } button { display: none; } }
      </style>
    </head>
    <body>
      <button onclick="window.print()">Download PDF</button>
      <section class="top">
        <div>
          <h1>${escapeHtml(input.title)}</h1>
          <span class="status">${escapeHtml(input.status)}</span>
        </div>
        <div class="document-meta">
          <div><div class="meta-label">Number</div><div class="meta-value">${escapeHtml(input.number)}</div></div>
          <div><div class="meta-label">Issue date</div><div class="meta-value">${escapeHtml(formatDate(input.issueDate))}</div></div>
          ${
            input.title === "Invoice"
              ? `<div><div class="meta-label">Due date</div><div class="meta-value">${escapeHtml(formatDate(input.dueDate))}</div></div>`
              : `<div><div class="meta-label">Valid for</div><div class="meta-value">7 days</div></div>`
          }
        </div>
      </section>
      <section class="party-grid">
        <div class="party">
          <div class="meta-label">From</div>
          <h2>${escapeHtml(input.companyInfo.name)}</h2>
          <div>${escapeHtml(input.companyInfo.phone)}</div>
          <div>${escapeHtml(input.companyInfo.email)}</div>
          <div>${escapeHtml(input.companyInfo.address)}</div>
        </div>
        <div class="party">
          <div class="meta-label">Bill to</div>
          <h2>${escapeHtml(input.customerInfo.name)}</h2>
          <div>${escapeHtml(input.customerInfo.phone)}</div>
          <div>${escapeHtml(input.customerInfo.address)}</div>
        </div>
      </section>
      <section style="margin-top: 24px;">
        <h2>${escapeHtml(input.jobTitle)}</h2>
        <p>${escapeHtml(input.jobDescription)}</p>
      </section>
      <table>
        <thead>
          <tr><th>Description</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th></tr>
        </thead>
        <tbody>
          ${input.items
            .map(
              (item) =>
                `<tr><td>${escapeHtml(item.description)}</td><td class="right">${item.quantity}</td><td class="right">R${item.unitPrice.toFixed(
                  2,
                )}</td><td class="right">R${item.total.toFixed(2)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <section class="totals">
        <div class="total-row"><span>Subtotal</span><strong>R${input.subtotal.toFixed(2)}</strong></div>
        ${
          input.vatRegistered
            ? `<div class="total-row"><span>VAT ${(input.vatRate * 100).toFixed(2).replace(/\.?0+$/, "")}%</span><strong>R${input.tax.toFixed(2)}</strong></div>`
            : `<div class="total-row"><span>VAT</span><strong>Not charged</strong></div>`
        }
        <div class="total-row grand-total"><span>Total</span><span>R${input.total.toFixed(2)}</span></div>
      </section>
      <section class="terms">
        ${
          input.title === "Quote"
            ? "Draft quote subject to site inspection, confirmed quantities, availability, and customer approval. Please confirm before work begins."
            : "Payment is due by the date shown above. Please use the invoice number as the payment reference and send proof of payment."
        }
      </section>
      <p class="footer">Prepared with SiteGent. This document was reviewed and approved by the issuing contractor.</p>
    </body>
  </html>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function renderRealInvoice(request: Request, id: string) {
  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/documents/invoice",
      action: "document_export",
      status: "failed",
      message: "Supabase user client is unavailable.",
      metadata: { documentType: "invoice", httpStatus: 500 },
    });
    return NextResponse.json({ error: "Supabase browser key is missing." }, { status: 500 });
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
      companies(name, phone, email, address),
      jobs(
        title,
        description,
        location,
        customers(name, phone, address),
        quotes(
          subtotal,
          tax,
          total,
          vat_registered,
          vat_rate,
          quote_items(description, quantity, unit_price, total)
        )
      )
    `,
    )
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (error || !data) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/documents/invoice",
      action: "document_export",
      status: "failed",
      message: error ? "Invoice export query failed." : "Invoice export record was not found.",
      metadata: { documentType: "invoice", httpStatus: error ? 500 : 404, code: error?.code ?? null },
    });
    return NextResponse.json({ error: error?.message ?? "Invoice not found." }, { status: error ? 500 : 404 });
  }

  const invoice = data as unknown as RealInvoiceRow;
  const quote = invoice.jobs?.quotes?.[0];
  const customer = invoice.jobs?.customers;
  const company = invoice.companies;
  const items =
    quote?.quote_items?.map((item) => ({
      description: item.description,
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unit_price),
      total: numberValue(item.total),
    })) ?? [];

  await recordPilotEvent(supabase, auth.companyId, auth.userId, "invoice_exported", { invoiceId: id });
  await recordOperationalEvent({
    userId: auth.userId,
    companyId: auth.companyId,
    route: "/api/documents/invoice",
    action: "document_export",
    status: "success",
    message: "Invoice exported.",
    metadata: { documentType: "invoice" },
    persist: false,
  });

  return renderDocument({
    title: "Invoice",
    number: invoice.invoice_number,
    status: invoice.status,
    issueDate: invoice.created_at,
    dueDate: invoice.due_date,
    companyInfo: {
      name: company?.name ?? "Company",
      phone: company?.phone ?? "",
      email: company?.email ?? "",
      address: company?.address ?? "",
    },
    customerInfo: {
      name: customer?.name ?? "Customer",
      phone: customer?.phone ?? "",
      address: customer?.address ?? invoice.jobs?.location ?? "",
    },
    jobTitle: invoice.jobs?.title ?? "Saved job",
    jobDescription: invoice.jobs?.description ?? "",
    items,
    subtotal: numberValue(quote?.subtotal),
    tax: numberValue(quote?.tax),
    total: numberValue(invoice.total),
    vatRegistered: quote?.vat_registered ?? numberValue(quote?.tax) > 0,
    vatRate: numberValue(quote?.vat_rate),
  });
}

async function renderRealQuote(request: Request, id: string) {
  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/documents/quote",
      action: "document_export",
      status: "failed",
      message: "Supabase user client is unavailable.",
      metadata: { documentType: "quote", httpStatus: 500 },
    });
    return NextResponse.json({ error: "Supabase browser key is missing." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("quotes")
    .select(
      `
      id,
      quote_number,
      subtotal,
      tax,
      total,
      vat_registered,
      vat_rate,
      status,
      created_at,
      companies(name, phone, email, address),
      jobs(
        title,
        description,
        location,
        customers(name, phone, address)
      ),
      quote_items(description, quantity, unit_price, total)
    `,
    )
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (error || !data) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/documents/quote",
      action: "document_export",
      status: "failed",
      message: error ? "Quote export query failed." : "Quote export record was not found.",
      metadata: { documentType: "quote", httpStatus: error ? 500 : 404, code: error?.code ?? null },
    });
    return NextResponse.json({ error: error?.message ?? "Quote not found." }, { status: error ? 500 : 404 });
  }

  const quote = data as unknown as RealQuoteRow;
  const customer = quote.jobs?.customers;
  const company = quote.companies;
  const items =
    quote.quote_items?.map((item) => ({
      description: item.description,
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unit_price),
      total: numberValue(item.total),
    })) ?? [];

  await recordPilotEvent(supabase, auth.companyId, auth.userId, "quote_exported", { quoteId: id });
  await recordOperationalEvent({
    userId: auth.userId,
    companyId: auth.companyId,
    route: "/api/documents/quote",
    action: "document_export",
    status: "success",
    message: "Quote exported.",
    metadata: { documentType: "quote" },
    persist: false,
  });

  return renderDocument({
    title: "Quote",
    number: quote.quote_number,
    status: quote.status,
    issueDate: quote.created_at,
    companyInfo: {
      name: company?.name ?? "Company",
      phone: company?.phone ?? "",
      email: company?.email ?? "",
      address: company?.address ?? "",
    },
    customerInfo: {
      name: customer?.name ?? "Customer",
      phone: customer?.phone ?? "",
      address: customer?.address ?? quote.jobs?.location ?? "",
    },
    jobTitle: quote.jobs?.title ?? "Saved job",
    jobDescription: quote.jobs?.description ?? "",
    items,
    subtotal: numberValue(quote.subtotal),
    tax: numberValue(quote.tax),
    total: numberValue(quote.total),
    vatRegistered: quote.vat_registered,
    vatRate: numberValue(quote.vat_rate),
  });
}

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (type === "invoice" && id && /^[0-9a-f-]{36}$/i.test(id)) {
    return renderRealInvoice(request, id);
  }

  if (type === "quote" && id && /^[0-9a-f-]{36}$/i.test(id)) {
    return renderRealQuote(request, id);
  }

  return NextResponse.json(
    {
      error:
        type === "invoice"
          ? "Save the job first, then export the real invoice from the Invoices tab."
          : "Save the job first, then export the real quote from Saved Jobs.",
    },
    { status: 404 },
  );
}
