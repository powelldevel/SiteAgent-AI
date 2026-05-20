import { NextResponse } from "next/server";
import { company, customers, invoices, jobs, quotes } from "@/lib/mock-data";

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const demoQuote = quotes.find((item) => item.id === "quote-3") ?? quotes[0];
  const quote = id === "quote-ai" || id === "invoice-ai" ? demoQuote : quotes.find((item) => item.id === id) ?? quotes[0];
  const invoice = invoices.find((item) => item.id === id) ?? {
    id: "invoice-ai",
    jobId: quote.jobId,
    invoiceNumber: "SG-I-DEMO-001",
    total: quote.total,
    status: "draft" as const,
    dueDate: "7 days after completion",
  };
  const sourceJob = jobs.find((job) => job.id === (type === "invoice" ? invoice.jobId : quote.jobId)) ?? jobs[0];
  const customer = customers.find((item) => item.id === sourceJob.customerId) ?? customers[0];
  const items = quote?.items ?? [];
  const total = type === "invoice" ? invoice?.total : quote?.total;
  const number = type === "invoice" ? invoice?.invoiceNumber : quote?.quoteNumber;
  const title = type === "invoice" ? "Invoice" : "Quote";

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title} ${number}</title>
      <style>
        * { box-sizing: border-box; }
        html, body { max-width: 100%; overflow-x: hidden; }
        body { font-family: Arial, sans-serif; color: #18201d; margin: 24px; }
        .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #1f8a5b; padding-bottom: 24px; flex-wrap: wrap; }
        h1 { margin: 0; font-size: clamp(30px, 10vw, 42px); }
        h2 { margin: 0 0 8px; font-size: 18px; }
        .muted { color: #66736d; }
        table { width: 100%; border-collapse: collapse; margin-top: 32px; table-layout: fixed; }
        th { text-align: left; background: #eef7f1; }
        th, td { padding: 12px; border-bottom: 1px solid #dce5df; overflow-wrap: anywhere; }
        .right { text-align: right; }
        .total { font-size: 24px; font-weight: 700; }
        .footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid #dce5df; color: #66736d; }
        button { min-height: 44px; border: 0; border-radius: 6px; background: #18201d; color: white; padding: 0 16px; font-weight: 700; }
        @media (max-width: 430px) {
          body { margin: 14px; font-size: 14px; }
          .top { gap: 16px; padding-bottom: 18px; }
          table, thead, tbody, tr, th, td { display: block; width: 100%; }
          thead { display: none; }
          tr { border-bottom: 1px solid #dce5df; padding: 10px 0; }
          td { display: flex; justify-content: space-between; gap: 12px; border-bottom: 0; padding: 6px 0; text-align: right; }
          td::before { color: #66736d; font-weight: 700; text-align: left; }
          td:nth-child(1)::before { content: "Description"; }
          td:nth-child(2)::before { content: "Qty"; }
          td:nth-child(3)::before { content: "Unit"; }
          td:nth-child(4)::before { content: "Total"; }
          .total { font-size: 20px; }
        }
        @media print { body { margin: 24px; } button { display: none; } }
      </style>
    </head>
    <body>
      <button onclick="window.print()">Download PDF</button>
      <section class="top">
        <div>
          <h1>${title}</h1>
          <p class="muted">${number}</p>
        </div>
        <div>
          <h2>${company.name}</h2>
          <div>${company.phone}</div>
          <div>${company.email}</div>
          <div>${company.address}</div>
        </div>
      </section>
      <section style="margin-top: 30px;">
        <h2>Bill to</h2>
        <div>${customer.name}</div>
        <div>${customer.phone}</div>
        <div>${customer.address}</div>
      </section>
      <section style="margin-top: 24px;">
        <h2>${sourceJob.title}</h2>
        <p>${sourceJob.description}</p>
      </section>
      <table>
        <thead>
          <tr><th>Description</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th></tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) =>
                `<tr><td>${item.description}</td><td class="right">${item.quantity}</td><td class="right">R${item.unitPrice.toFixed(
                  2,
                )}</td><td class="right">R${item.total.toFixed(2)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p class="right total">Total: R${(total ?? 0).toFixed(2)}</p>
      <p class="footer">Powered by SiteGent - AI operations for contractors.</p>
    </body>
  </html>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
