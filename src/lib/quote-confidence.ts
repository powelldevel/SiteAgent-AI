import type { QuoteItem, QuotePricingStatus } from "./types";

export type QuoteConfidenceView = {
  status: QuotePricingStatus;
  label: string;
  detail: string;
  className: string;
};

export function getQuotePricingStatus(item: QuoteItem): QuotePricingStatus {
  if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) return "needs_review";
  if (item.pricingStatus) return item.pricingStatus;
  if (item.pricingSource === "company_price_list") return "matched";
  return "estimated";
}

export function quoteConfidenceView(item: QuoteItem): QuoteConfidenceView {
  const status = getQuotePricingStatus(item);

  if (status === "matched") {
    return {
      status,
      label: "Matched company price",
      detail: "Exact name or alias match from your price list",
      className: "border-[#86efac] bg-[#f0fdf4] text-[#166534]",
    };
  }

  if (status === "needs_review") {
    return {
      status,
      label: "Needs review",
      detail: "No usable price is available for this line",
      className: "border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]",
    };
  }

  return {
    status,
    label: "Estimated price",
    detail: item.pricingSource === "manual" ? "Edited manually; confirm before sending" : "AI-inferred price; confirm before sending",
    className: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
  };
}
