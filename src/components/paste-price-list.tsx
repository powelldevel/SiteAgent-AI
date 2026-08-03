"use client";

import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { parsePriceList } from "@/lib/price-list-parser";
import type { PriceCategory, PriceItem } from "@/lib/types";

type ImportDraft = {
  id: string;
  sourceLine: string;
  name: string;
  category: PriceCategory;
  currency: string;
  unit: string;
  unitPrice: string;
};

const categories: PriceCategory[] = ["material", "labour", "delivery", "service", "fee", "other"];
const example = "Labour R950/day\nCallout R450\nPVC Pipe R85/m\nSealant R120";

function rowError(row: ImportDraft) {
  const price = Number(row.unitPrice);
  if (!row.name.trim()) return "Item name is required.";
  if (row.currency !== "ZAR") return "Only ZAR prices can be imported.";
  if (!row.unit.trim()) return "Unit is required.";
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return "Enter a valid price.";
  return null;
}

export function PastePriceList({
  loading,
  onImport,
}: {
  loading: boolean;
  onImport: (items: Omit<PriceItem, "id">[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportDraft[]>([]);

  const validCount = useMemo(() => rows.filter((row) => !rowError(row)).length, [rows]);

  function preview() {
    setRows(
      parsePriceList(text).map((row, index) => ({
        id: `${index}-${row.sourceLine}`,
        sourceLine: row.sourceLine,
        name: row.name,
        category: row.category,
        currency: row.currency ?? "",
        unit: row.unit,
        unitPrice: row.unitPrice === null ? "" : String(row.unitPrice),
      })),
    );
  }

  function updateRow(id: string, updates: Partial<ImportDraft>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  }

  async function importRows() {
    const validRows = rows.filter((row) => !rowError(row));
    if (validRows.length !== rows.length || validRows.length === 0) return;

    const imported = await onImport(
      validRows.map((row) => ({
        name: row.name.trim(),
        category: row.category,
        unit: row.unit.trim(),
        unitPrice: Number(row.unitPrice),
        vatRate: 0.15,
        aliases: [],
        notes: `Imported from: ${row.sourceLine}`.slice(0, 500),
        active: true,
      })),
    );

    if (imported) {
      setText("");
      setRows([]);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#166534] bg-white px-4 text-sm font-black text-[#166534] hover:bg-[#f0fdf4] sm:w-auto"
      >
        <ClipboardPaste size={17} />
        Paste price list
      </button>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-black text-[#14532d]">Paste price list</p>
          <p className="mt-1 text-sm leading-6 text-[#3f5f4b]">One item per line. Review every row before importing.</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-left text-sm font-black text-[#516158] hover:text-[#111827]">
          Close
        </button>
      </div>

      {rows.length === 0 ? (
        <>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-36 min-w-0 resize-y rounded-md border border-[#86efac] bg-white p-3 font-mono text-sm outline-none focus:border-[#166534]"
            placeholder={example}
          />
          <button
            onClick={preview}
            disabled={!text.trim()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#166534] px-4 text-sm font-black text-white hover:bg-[#14532d] disabled:opacity-60 sm:w-auto"
          >
            <Plus size={17} />
            Preview prices
          </button>
        </>
      ) : (
        <>
          <div className="grid gap-3">
            {rows.map((row) => {
              const error = rowError(row);
              return (
                <article key={row.id} className={`grid min-w-0 gap-3 rounded-md border bg-white p-3 ${error ? "border-[#fecaca]" : "border-[#d1d5db]"}`}>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(120px,0.7fr)_minmax(110px,0.6fr)_minmax(110px,0.6fr)_40px]">
                    <label className="grid gap-1 text-xs font-black">
                      Item
                      <input value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} className="h-10 min-w-0 rounded-md border border-[#d1d5db] px-3 text-sm font-normal" />
                    </label>
                    <label className="grid gap-1 text-xs font-black">
                      Category
                      <select value={row.category} onChange={(event) => updateRow(row.id, { category: event.target.value as PriceCategory })} className="h-10 min-w-0 rounded-md border border-[#d1d5db] bg-white px-2 text-sm font-normal">
                        {categories.map((category) => <option key={category}>{category}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-black">
                      Price
                      <input value={row.unitPrice} onChange={(event) => updateRow(row.id, { unitPrice: event.target.value })} inputMode="decimal" className="h-10 min-w-0 rounded-md border border-[#d1d5db] px-3 text-sm font-normal" />
                    </label>
                    <label className="grid gap-1 text-xs font-black">
                      Unit
                      <input value={row.unit} onChange={(event) => updateRow(row.id, { unit: event.target.value })} className="h-10 min-w-0 rounded-md border border-[#d1d5db] px-3 text-sm font-normal" />
                    </label>
                    <button onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#fecaca] text-[#991b1b]" title="Remove row">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-[#f3f4f6] px-2 py-1 font-bold">{row.currency || "Currency missing"}</span>
                    <span className="truncate text-[#69746f]">Original: {row.sourceLine}</span>
                  </div>
                  {error && <p className="text-sm font-bold text-[#b91c1c]">{error}</p>}
                </article>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#516158]">{validCount} of {rows.length} rows ready</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => setRows([])} className="h-10 rounded-md border border-[#d1d5db] bg-white px-4 text-sm font-black">Back</button>
              <button
                onClick={() => void importRows()}
                disabled={loading || validCount === 0 || validCount !== rows.length}
                className="h-10 rounded-md bg-[#166534] px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {loading ? "Importing..." : `Import ${validCount} prices`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
