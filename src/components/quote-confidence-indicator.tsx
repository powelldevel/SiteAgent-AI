import { AlertTriangle, CheckCircle2, CircleDollarSign } from "lucide-react";
import { quoteConfidenceView } from "@/lib/quote-confidence";
import type { QuoteItem } from "@/lib/types";

export function QuoteConfidenceIndicator({ item }: { item: QuoteItem }) {
  const view = quoteConfidenceView(item);
  const Icon = view.status === "matched" ? CheckCircle2 : view.status === "estimated" ? CircleDollarSign : AlertTriangle;

  return (
    <div className={`flex min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-xs ${view.className}`}>
      <Icon className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-black">{view.label}</span>
        <span className="mt-0.5 block font-semibold">{view.detail}</span>
      </span>
    </div>
  );
}
