"use client";

import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileText,
  HardHat,
  Inbox,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  Send,
  Settings,
  Sparkles,
  Truck,
  Users,
  WalletCards,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { customers, demoMessages, invoices, jobs, quotes, sampleMessage, workers } from "@/lib/mock-data";
import type { ExtractedJob, Job, JobStatus, Quote } from "@/lib/types";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "AI Inbox", icon: Inbox },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "customers", label: "Customers", icon: Users },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
  { id: "workers", label: "Workers", icon: HardHat },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type View = (typeof nav)[number]["id"];

type SavedJob = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: string;
  urgency: string;
  scheduled_date: string | null;
  created_at: string;
  customers?: { name: string | null; phone: string | null } | null;
  quotes?: { total: number | null; status: string | null }[] | null;
  invoices?: { total: number | null; status: string | null }[] | null;
};

const statuses: JobStatus[] = ["new", "quoted", "accepted", "scheduled"];

const workflow = [
  "Customer Message",
  "AI Extraction",
  "Job Card",
  "Quote Draft",
  "Invoice Draft",
  "Follow-up Message",
];

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
}

export default function Home() {
  const [active, setActive] = useState<View>("dashboard");
  const [message, setMessage] = useState(sampleMessage);
  const [extracted, setExtracted] = useState<ExtractedJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("demo");
  const [selectedDemo, setSelectedDemo] = useState("Plumbing leak");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [savedJobsLoading, setSavedJobsLoading] = useState(false);
  const [savedJobsMessage, setSavedJobsMessage] = useState("");
  const [savedJobsError, setSavedJobsError] = useState("");
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  const generatedQuote = useMemo<Quote | null>(() => {
    if (!extracted) return null;
    const subtotal = extracted.quoteItems.reduce((sum, item) => sum + item.total, 0);
    return {
      id: "quote-ai",
      jobId: "job-ai",
      quoteNumber: "SG-Q-DEMO-001",
      subtotal,
      tax: subtotal * 0.15,
      total: subtotal * 1.15,
      status: "draft",
      items: extracted.quoteItems,
    };
  }, [extracted]);

  const liveJob: Job | null = extracted
    ? {
        id: "job-ai",
        customerId: "cust-ai",
        title: extracted.title,
        description: extracted.summary,
        location: extracted.location,
        status: "new",
        urgency: extracted.urgency,
        scheduledDate: extracted.estimatedDate,
        assignedWorkerId: workers.find((worker) => worker.availabilityStatus === "available")?.id,
      }
    : null;

  async function loadSavedJobs() {
    setSavedJobsLoading(true);
    setSavedJobsError("");
    try {
      const response = await fetch("/api/saved-jobs");
      const data = await response.json();
      setSupabaseConnected(Boolean(data.connected));
      setSavedJobs(data.jobs ?? []);
      setSavedJobsMessage(data.message ?? "");
      if (!response.ok) {
        setSavedJobsError(data.error ?? "Could not load saved jobs.");
      }
    } catch (error) {
      setSupabaseConnected(false);
      setSavedJobsError(error instanceof Error ? error.message : "Could not load saved jobs.");
    } finally {
      setSavedJobsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSavedJobs() {
      setSavedJobsLoading(true);
      setSavedJobsError("");
      try {
        const response = await fetch("/api/saved-jobs");
        const data = await response.json();
        if (cancelled) return;
        setSupabaseConnected(Boolean(data.connected));
        setSavedJobs(data.jobs ?? []);
        setSavedJobsMessage(data.message ?? "");
        if (!response.ok) {
          setSavedJobsError(data.error ?? "Could not load saved jobs.");
        }
      } catch (error) {
        if (cancelled) return;
        setSupabaseConnected(false);
        setSavedJobsError(error instanceof Error ? error.message : "Could not load saved jobs.");
      } finally {
        if (!cancelled) {
          setSavedJobsLoading(false);
        }
      }
    }

    void loadInitialSavedJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  function fillDemo(label = demoMessages[0].label) {
    const demo = demoMessages.find((item) => item.label === label) ?? demoMessages[0];
    setSelectedDemo(demo.label);
    setMessage(demo.body);
    setExtracted(null);
    setSaveMessage("");
    setSaveError("");
    setActive("inbox");
  }

  async function runExtraction() {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not extract the job.");
      setExtracted(data.job);
      setMode(data.mode);
      setSaveMessage("");
      setSaveError("");
      setActive("inbox");
    } finally {
      setLoading(false);
    }
  }

  async function saveOperationsPack() {
    if (!extracted || !generatedQuote) return;

    setSaveLoading(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const response = await fetch("/api/operations/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originalMessage: message,
          extractionMode: mode,
          job: extracted,
          quote: {
            quoteNumber: generatedQuote.quoteNumber,
            subtotal: generatedQuote.subtotal,
            tax: generatedQuote.tax,
            total: generatedQuote.total,
            items: generatedQuote.items,
          },
        }),
      });
      const data = await response.json();

      if (!data.connected) {
        setSupabaseConnected(false);
        setSaveMessage(data.message ?? "Demo mode: Supabase is not connected yet.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Could not save operations pack.");
      }

      setSupabaseConnected(true);
      setSaveMessage(data.message ?? "Operations pack saved.");
      await loadSavedJobs();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save operations pack.");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f3ed] text-[#101814]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl min-w-0 flex-col lg:flex-row">
        <aside className="sticky top-0 z-30 w-full min-w-0 border-b border-[#ded7ca] bg-[#f6f3ed]/95 px-3 py-3 backdrop-blur sm:px-4 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:block">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-10 place-items-center rounded bg-[#158052] text-white shadow-sm">
                <HardHat size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black">SiteGent</p>
                <p className="text-xs font-medium text-[#69746f]">AI contractor ops</p>
              </div>
            </div>
            <button
              onClick={() => fillDemo(selectedDemo)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded bg-[#101814] px-3 text-sm font-bold text-white hover:bg-[#24342c] lg:hidden"
            >
              <Sparkles size={16} />
              Demo
            </button>
          </div>
          <nav className="mt-4 grid grid-cols-3 gap-2 pb-1 min-[420px]:grid-cols-4 sm:flex sm:flex-wrap lg:mt-8 lg:flex-col">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded px-2 text-xs font-bold sm:justify-start sm:px-3 sm:text-sm lg:gap-3 ${
                    active === item.id
                      ? "bg-[#101814] text-white shadow-sm"
                      : "text-[#5e6d65] hover:bg-white hover:text-[#101814]"
                  }`}
                  title={item.label}
                >
                  <Icon className="shrink-0" size={18} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-8 hidden rounded border border-[#ded7ca] bg-white p-4 shadow-sm lg:block">
            <p className="text-sm font-black">Founder demo path</p>
            <p className="mt-2 text-sm leading-6 text-[#69746f]">
              Pick a WhatsApp request, run AI, export quote, export invoice.
            </p>
            <button
              onClick={() => fillDemo("Sand delivery")}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-[#e6b84b] px-3 text-sm font-black text-[#101814] hover:bg-[#f0c85f]"
            >
              <WandSparkles size={16} />
              Demo Mode
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-3 pb-6 pt-28 sm:px-6 sm:pt-6 lg:px-8 lg:py-7">
          <Hero onStart={() => fillDemo("Sand delivery")} onInbox={() => setActive("inbox")} />
          <WorkflowStrip extracted={extracted} loading={loading} />
          {active === "dashboard" && (
            <Dashboard
              extracted={extracted}
              liveJob={liveJob}
              quote={generatedQuote}
              savedJobs={savedJobs}
              savedJobsLoading={savedJobsLoading}
              savedJobsMessage={savedJobsMessage}
              savedJobsError={savedJobsError}
              supabaseConnected={supabaseConnected}
              reloadSavedJobs={loadSavedJobs}
            />
          )}
          {active === "inbox" && (
            <InboxView
              message={message}
              setMessage={setMessage}
              runExtraction={runExtraction}
              loading={loading}
              extracted={extracted}
              quote={generatedQuote}
              mode={mode}
              selectedDemo={selectedDemo}
              fillDemo={fillDemo}
              saveOperationsPack={saveOperationsPack}
              saveLoading={saveLoading}
              saveMessage={saveMessage}
              saveError={saveError}
              supabaseConnected={supabaseConnected}
            />
          )}
          {active === "jobs" && <JobsView liveJob={liveJob} />}
          {active === "customers" && <CustomersView extracted={extracted} />}
          {active === "quotes" && <QuotesView quote={generatedQuote} />}
          {active === "invoices" && <InvoicesView quote={generatedQuote} extracted={extracted} />}
          {active === "workers" && <WorkersView />}
          {active === "settings" && <SettingsView />}
        </section>
      </div>
    </main>
  );
}

function Hero({ onStart, onInbox }: { onStart: () => void; onInbox: () => void }) {
  return (
    <section className="mb-5 overflow-hidden rounded border border-[#19362a] bg-[#101814] text-white shadow-xl">
      <div className="grid min-w-0 gap-5 p-4 sm:gap-6 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:p-8">
        <div className="min-w-0">
          <p className="inline-flex max-w-full rounded bg-white/10 px-3 py-1 text-xs font-bold leading-5 text-[#9fe4bd] sm:text-sm">
            WhatsApp-first AI ops for South African contractors
          </p>
          <h1 className="mt-4 max-w-3xl break-words text-3xl font-black leading-[1.08] min-[380px]:text-[2.15rem] sm:text-5xl lg:text-6xl">
            From messy message to quote and invoice in one flow.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9d8d0] sm:text-base sm:leading-7 lg:text-lg">
            SiteGent reads customer requests, extracts job details, drafts quote lines in Rand, prepares the invoice,
            and gives the contractor a follow-up message that sounds human.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={onStart}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded bg-[#e6b84b] px-4 text-sm font-black text-[#101814] hover:bg-[#f0c85f] sm:w-auto sm:px-5 sm:text-base"
            >
              Run founder demo
              <ArrowRight size={18} />
            </button>
            <button
              onClick={onInbox}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded border border-white/20 px-4 text-sm font-bold text-white hover:bg-white/10 sm:w-auto sm:px-5 sm:text-base"
            >
              <MessageCircle size={18} />
              Open AI Inbox
            </button>
          </div>
        </div>
        <div className="grid min-w-0 content-end gap-3">
          {[
            ["4 demo trades", "Sand, plumbing, electrical, renovation"],
            ["R-priced quotes", "Line items, VAT, total"],
            ["Export ready", "Quote and invoice document routes"],
          ].map(([title, text]) => (
            <div key={title} className="min-w-0 rounded border border-white/10 bg-white/[0.07] p-3 sm:p-4">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="text-[#9fe4bd]" size={19} />
                <p className="min-w-0 break-words font-black">{title}</p>
              </div>
              <p className="mt-2 min-w-0 break-words text-sm leading-6 text-[#c9d8d0]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowStrip({ extracted, loading }: { extracted: ExtractedJob | null; loading: boolean }) {
  return (
    <section className="mb-5 min-w-0 rounded border border-[#ded7ca] bg-white p-2 shadow-sm sm:p-3">
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {workflow.map((step, index) => {
          const active = index === 0 || loading || Boolean(extracted);
          return (
            <div key={step} className="min-w-0">
              <div
                className={`flex min-h-12 min-w-0 items-center gap-2 rounded px-2 text-xs font-black sm:px-3 sm:text-sm ${
                  active ? "bg-[#eaf6ee] text-[#12623f]" : "bg-[#f4f0e8] text-[#8a8175]"
                }`}
              >
                {loading && index === 1 ? (
                  <Loader2 className="shrink-0 animate-spin" size={16} />
                ) : (
                  <CheckCircle2 className="shrink-0" size={16} />
                )}
                <span className="min-w-0 leading-4">{step}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard({
  extracted,
  liveJob,
  quote,
  savedJobs,
  savedJobsLoading,
  savedJobsMessage,
  savedJobsError,
  supabaseConnected,
  reloadSavedJobs,
}: {
  extracted: ExtractedJob | null;
  liveJob: Job | null;
  quote: Quote | null;
  savedJobs: SavedJob[];
  savedJobsLoading: boolean;
  savedJobsMessage: string;
  savedJobsError: string;
  supabaseConnected: boolean | null;
  reloadSavedJobs: () => Promise<void>;
}) {
  const dashboardJobs = liveJob ? [liveJob, ...jobs] : jobs;
  const openValue = quotes.reduce((sum, item) => sum + item.total, 0) + (quote?.total ?? 0);
  return (
    <section className="grid min-w-0 gap-4 sm:gap-5">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open jobs" value={String(dashboardJobs.length)} icon={ClipboardList} />
        <Metric label="Quote pipeline" value={money(openValue)} icon={WalletCards} />
        <Metric label="Invoices sent" value={String(invoices.length + (extracted ? 1 : 0))} icon={ReceiptText} />
        <Metric label="Workers available" value={String(workers.filter((worker) => worker.availabilityStatus === "available").length)} icon={HardHat} />
      </div>
      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
        <Panel title="Live Job Board">
          <JobColumns jobs={dashboardJobs} />
        </Panel>
        <Panel title="Demo Workload">
          <div className="space-y-3">
            {[
              ["Sand delivery", "6 cubes river sand, 2 cubes stone", Truck],
              ["Plumbing", "Leaking shower and tile repair", PackageCheck],
              ["Electrical", "DB board trip and breaker quote", Zap],
              ["Renovation", "Shop front counter, drywall, paint", HardHat],
            ].map(([title, text, Icon]) => (
              <div key={title as string} className="flex min-w-0 gap-3 rounded border border-[#ded7ca] bg-white p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded bg-[#eef7f1] text-[#158052]">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-black">{title as string}</p>
                  <p className="text-sm leading-5 text-[#69746f]">{text as string}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <SavedJobsSection
        jobs={savedJobs}
        loading={savedJobsLoading}
        message={savedJobsMessage}
        error={savedJobsError}
        connected={supabaseConnected}
        reload={reloadSavedJobs}
      />
    </section>
  );
}

function InboxView({
  message,
  setMessage,
  runExtraction,
  loading,
  extracted,
  quote,
  mode,
  selectedDemo,
  fillDemo,
  saveOperationsPack,
  saveLoading,
  saveMessage,
  saveError,
  supabaseConnected,
}: {
  message: string;
  setMessage: (value: string) => void;
  runExtraction: () => void;
  loading: boolean;
  extracted: ExtractedJob | null;
  quote: Quote | null;
  mode: string;
  selectedDemo: string;
  fillDemo: (label?: string) => void;
  saveOperationsPack: () => Promise<void>;
  saveLoading: boolean;
  saveMessage: string;
  saveError: string;
  supabaseConnected: boolean | null;
}) {
  return (
    <section className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
      <Panel title="AI Job Intake">
        <div className="space-y-4">
          <div className="rounded border border-[#ded7ca] bg-[#f9f6ef] p-3">
            <p className="mb-3 text-sm font-black">Demo Mode</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {demoMessages.map((demo) => (
                <button
                  key={demo.label}
                  onClick={() => fillDemo(demo.label)}
                  className={`h-11 min-w-0 rounded px-3 text-left text-sm font-bold ${
                    selectedDemo === demo.label
                      ? "bg-[#101814] text-white"
                      : "bg-white text-[#516158] hover:bg-[#eef7f1]"
                  }`}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-48 w-full min-w-0 resize-none rounded border border-[#cfc6b5] bg-white p-3 text-sm leading-6 shadow-inner outline-none focus:border-[#158052] focus:ring-2 focus:ring-[#158052]/20 sm:min-h-56 sm:p-4 sm:text-base sm:leading-7"
            placeholder="Paste a WhatsApp message or voice-note transcript..."
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={runExtraction}
              disabled={loading}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded bg-[#158052] px-4 text-sm font-black text-white hover:bg-[#116b44] disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:text-base"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Run AI extraction
            </button>
            <button
              onClick={() => fillDemo("Sand delivery")}
              className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded border border-[#cfc6b5] bg-white px-4 text-sm font-bold text-[#101814] hover:bg-[#f8fbf5] sm:w-auto sm:px-5 sm:text-base"
            >
              <WandSparkles size={18} />
              Demo Mode
            </button>
          </div>
          <p className="text-sm font-medium text-[#69746f]">Mode: {mode === "ai" ? "OpenAI extraction" : "demo extractor"}</p>
        </div>
      </Panel>

      <Panel title="Generated Operations Pack">
        {extracted && quote ? (
          <div className="grid min-w-0 gap-4">
            <div className="min-w-0 rounded border border-[#b9e1c7] bg-[#f2fbf5] p-3 sm:p-4">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#158052]">AI Extraction</p>
                  <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{extracted.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#516158]">{extracted.summary}</p>
                </div>
                <Badge>{extracted.urgency}</Badge>
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Customer" value={extracted.customerName} />
              <Info label="Phone" value={extracted.phone} />
              <Info label="Location" value={extracted.location} />
              <Info label="When" value={extracted.estimatedDate} />
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="min-w-0">
                <p className="mb-2 text-sm font-black">Quote Draft</p>
                <div className="overflow-hidden rounded border border-[#ded7ca]">
                  {quote.items.map((item) => (
                    <div
                      key={item.description}
                      className="grid min-w-0 grid-cols-1 gap-1 border-b border-[#ded7ca] bg-white p-3 last:border-b-0 min-[380px]:grid-cols-[minmax(0,1fr)_auto] min-[380px]:gap-3"
                    >
                      <span className="min-w-0 text-sm leading-5">{item.description}</span>
                      <span className="min-w-0 text-left font-mono text-sm font-black min-[380px]:text-right">{money(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 min-w-0 rounded bg-[#101814] p-3 text-white sm:p-4">
                  <div className="flex min-w-0 justify-between gap-3 text-sm text-[#c9d8d0]">
                    <span>Subtotal</span>
                    <span>{money(quote.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex min-w-0 justify-between gap-3 text-sm text-[#c9d8d0]">
                    <span>VAT 15%</span>
                    <span>{money(quote.tax)}</span>
                  </div>
                  <div className="mt-3 flex min-w-0 justify-between gap-3 text-lg font-black sm:text-xl">
                    <span>Total</span>
                    <span>{money(quote.total)}</span>
                  </div>
                </div>
              </div>
              <div className="grid min-w-0 gap-3">
                <ArtifactCard
                  title="Job Card"
                  text={`${extracted.jobType} work in ${extracted.location}. Assigned to next available worker.`}
                  icon={ClipboardList}
                />
                <ArtifactCard
                  title="Invoice Draft"
                  text={`Draft invoice total ${money(quote.total)}. Due 7 days after completion.`}
                  icon={ReceiptText}
                />
                <div className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 sm:p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-black">
                    <Copy size={16} />
                    Follow-up Message
                  </p>
                  <p className="text-sm leading-6 text-[#516158]">{extracted.followUpMessage}</p>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <ExportButton href="/api/documents/quote?id=quote-ai" label="Export Quote" icon={Download} />
              <ExportButton href="/api/documents/invoice?id=invoice-ai" label="Export Invoice" icon={Download} />
            </div>
            <div className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-black">Confirm and save</p>
                  <p className="mt-1 text-sm leading-6 text-[#69746f]">
                    Save this pack as customer, message, job, quote, invoice, and AI audit records.
                  </p>
                </div>
                <button
                  onClick={saveOperationsPack}
                  disabled={saveLoading}
                  className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded bg-[#158052] px-4 text-sm font-black text-white hover:bg-[#116b44] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-5 sm:text-base"
                >
                  {saveLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Save Operations Pack
                </button>
              </div>
              {supabaseConnected === false && !saveMessage && (
                <StatusMessage tone="info" text="Demo mode: Supabase is not connected yet." />
              )}
              {saveMessage && <StatusMessage tone={supabaseConnected ? "success" : "info"} text={saveMessage} />}
              {saveError && <StatusMessage tone="error" text={saveError} />}
            </div>
          </div>
        ) : (
          <EmptyState text="Choose Demo Mode, run AI extraction, and SiteGent will generate the job card, quote, invoice, and follow-up." />
        )}
      </Panel>
    </section>
  );
}

function SavedJobsSection({
  jobs,
  loading,
  message,
  error,
  connected,
  reload,
}: {
  jobs: SavedJob[];
  loading: boolean;
  message: string;
  error: string;
  connected: boolean | null;
  reload: () => Promise<void>;
}) {
  return (
    <Panel title="Saved Jobs">
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#516158]">
            {connected ? "Reading saved jobs from Supabase." : "Demo mode: Supabase is not connected yet."}
          </p>
          {message && <p className="mt-1 text-sm text-[#69746f]">{message}</p>}
        </div>
        <button
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-[#cfc6b5] bg-white px-4 text-sm font-black text-[#101814] hover:bg-[#f8fbf5] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Inbox size={16} />}
          Refresh
        </button>
      </div>
      {error && <StatusMessage tone="error" text={error} />}
      {loading && (
        <div className="grid min-h-28 place-items-center rounded border border-dashed border-[#cfc6b5] bg-white text-sm font-bold text-[#69746f]">
          Loading saved jobs...
        </div>
      )}
      {!loading && connected && jobs.length === 0 && (
        <div className="grid min-h-28 place-items-center rounded border border-dashed border-[#cfc6b5] bg-white p-5 text-center text-sm font-bold text-[#69746f]">
          No saved jobs yet. Run AI extraction, then click Save Operations Pack.
        </div>
      )}
      {!loading && jobs.length > 0 && (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {jobs.map((job) => {
            const quoteTotal = Number(job.quotes?.[0]?.total ?? 0);
            return (
              <article key={job.id} className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
                <div className="flex min-w-0 flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:justify-between">
                  <div className="min-w-0">
                    <p className="font-black">{job.title}</p>
                    <p className="mt-1 text-sm text-[#69746f]">
                      {job.customers?.name ?? "Customer"} - {job.location ?? "Location to confirm"}
                    </p>
                  </div>
                  <Badge>{job.status}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#516158]">{job.description}</p>
                <div className="mt-4 flex min-w-0 flex-wrap gap-2 text-xs font-black text-[#516158]">
                  <span className="min-w-0 rounded bg-[#f4f0e8] px-2 py-1">Urgency: {job.urgency}</span>
                  <span className="min-w-0 rounded bg-[#f4f0e8] px-2 py-1">
                    Quote: {quoteTotal > 0 ? money(quoteTotal) : "Draft"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function JobsView({ liveJob }: { liveJob: Job | null }) {
  return (
    <Panel title="Jobs">
      <JobColumns jobs={liveJob ? [liveJob, ...jobs] : jobs} />
    </Panel>
  );
}

function CustomersView({ extracted }: { extracted: ExtractedJob | null }) {
  const rows = extracted
    ? [{ id: "cust-ai", name: extracted.customerName, phone: extracted.phone, email: "To confirm", address: extracted.location }, ...customers]
    : customers;
  return (
    <Panel title="Customers">
      <GridList rows={rows.map((customer) => ({ id: customer.id, title: customer.name, meta: customer.phone, detail: customer.address }))} />
    </Panel>
  );
}

function QuotesView({ quote }: { quote: Quote | null }) {
  const rows = quote ? [quote, ...quotes] : quotes;
  return (
    <Panel title="Quotes">
      <div className="grid min-w-0 gap-3">
        {rows.map((item) => (
          <div key={item.id} className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
            <div className="flex min-w-0 flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
              <div className="min-w-0">
                <p className="font-black">{item.quoteNumber}</p>
                <p className="text-sm capitalize text-[#69746f]">{item.status}</p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 min-[380px]:w-auto min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
                <p className="min-w-0 font-mono font-black">{money(item.total)}</p>
                <ExportButton href={`/api/documents/quote?id=${item.id}`} label="Export Quote" icon={Download} compact />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function InvoicesView({ quote, extracted }: { quote: Quote | null; extracted: ExtractedJob | null }) {
  const generated = quote && extracted ? [{ id: "invoice-ai", invoiceNumber: "SG-I-DEMO-001", total: quote.total, status: "draft", dueDate: "7 days after completion" }] : [];
  return (
    <Panel title="Invoices">
      <div className="grid min-w-0 gap-3">
        {[...generated, ...invoices].map((item) => (
          <div key={item.id} className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
            <div className="flex min-w-0 flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
              <div className="min-w-0">
                <p className="font-black">{item.invoiceNumber}</p>
                <p className="text-sm text-[#69746f]">Due: {item.dueDate}</p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 min-[380px]:w-auto min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
                <Badge>{item.status}</Badge>
                <p className="min-w-0 font-mono font-black">{money(item.total)}</p>
                <ExportButton href={`/api/documents/invoice?id=${item.id}`} label="Export Invoice" icon={Download} compact />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WorkersView() {
  return (
    <Panel title="Workers">
      <GridList rows={workers.map((worker) => ({ id: worker.id, title: worker.name, meta: worker.role, detail: `${worker.phone} - ${worker.availabilityStatus}` }))} />
    </Panel>
  );
}

function SettingsView() {
  return (
    <section id="setup" className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
      <Panel title="Setup">
        <div className="space-y-3 text-sm leading-6 text-[#516158]">
          <p>Connect Supabase Auth, Postgres, and Storage using the environment variables in the README.</p>
          <p>Add an OpenAI API key to switch the extractor from deterministic demo mode to live AI JSON extraction.</p>
          <p>Replace browser print with Playwright PDF generation when pilots need downloadable files saved to storage.</p>
        </div>
      </Panel>
      <Panel title="Company Profile">
        <div className="grid min-w-0 gap-3">
          {["Company name", "Phone", "Email", "Address", "VAT number"].map((label) => (
            <label key={label} className="grid gap-1 text-sm font-bold">
              {label}
              <input className="h-11 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]" placeholder={label} />
            </label>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function JobColumns({ jobs: rows }: { jobs: Job[] }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {statuses.map((status) => (
        <div key={status} className="min-h-36 min-w-0 rounded border border-[#ded7ca] bg-[#faf8f2] p-3 sm:min-h-44">
          <p className="mb-3 flex items-center gap-2 text-sm font-black capitalize">
            <CalendarDays size={15} />
            {status.replace("_", " ")}
          </p>
          <div className="min-w-0 space-y-3">
            {rows
              .filter((job) => job.status === status)
              .map((job) => (
                <article key={job.id} className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-black leading-5">{job.title}</h3>
                    <Badge>{job.urgency}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#69746f]">{job.location}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#516158]">{job.description}</p>
                </article>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-bold text-[#69746f]">{label}</p>
        <Icon size={19} className="shrink-0 text-[#158052]" />
      </div>
      <p className="mt-3 min-w-0 break-words text-xl font-black sm:text-2xl">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded border border-[#ded7ca] bg-[#fffdf8] p-3 shadow-sm sm:p-5">
      <h2 className="mb-4 text-base font-black sm:text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex max-w-full shrink-0 rounded bg-[#e9f4ec] px-2 py-1 text-xs font-black capitalize text-[#12623f]">{children}</span>;
}

function StatusMessage({ tone, text }: { tone: "success" | "error" | "info"; text: string }) {
  const styles = {
    success: "border-[#b9e1c7] bg-[#f2fbf5] text-[#12623f]",
    error: "border-[#f0b8b0] bg-[#fff4f2] text-[#a33a2a]",
    info: "border-[#d8d0c0] bg-[#f9f6ef] text-[#516158]",
  };
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <div className={`mt-3 flex min-w-0 items-start gap-2 rounded border p-3 text-sm font-bold ${styles[tone]}`}>
      <Icon className="mt-0.5 shrink-0" size={16} />
      <span className="min-w-0">{text}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm">
      <p className="text-xs font-black uppercase text-[#69746f]">{label}</p>
      <p className="mt-1 min-w-0 break-words font-bold">{value}</p>
    </div>
  );
}

function ArtifactCard({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
      <p className="mb-2 flex min-w-0 items-center gap-2 text-sm font-black">
        <Icon className="shrink-0" size={16} />
        <span className="min-w-0">{title}</span>
      </p>
      <p className="text-sm leading-6 text-[#516158]">{text}</p>
    </div>
  );
}

function ExportButton({ href, label, icon: Icon, compact = false }: { href: string; label: string; icon: LucideIcon; compact?: boolean }) {
  return (
    <a
      className={`inline-flex min-w-0 items-center justify-center gap-2 rounded bg-[#101814] font-black text-white hover:bg-[#24342c] ${
        compact ? "h-10 w-full px-3 text-sm min-[380px]:w-auto" : "h-12 w-full px-4 text-sm sm:w-auto sm:px-5 sm:text-base"
      }`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <Icon className="shrink-0" size={17} />
      <span className="truncate">{label}</span>
    </a>
  );
}

function GridList({ rows }: { rows: { id: string; title: string; meta: string; detail: string }[] }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article key={row.id} className="min-w-0 rounded border border-[#ded7ca] bg-white p-3 shadow-sm sm:p-4">
          <p className="min-w-0 break-words font-black">{row.title}</p>
          <p className="mt-1 min-w-0 break-words text-sm text-[#69746f]">{row.meta}</p>
          <p className="mt-3 min-w-0 break-words text-sm">{row.detail}</p>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-60 min-w-0 place-items-center rounded border border-dashed border-[#cfc6b5] bg-white p-5 text-center text-sm text-[#69746f] sm:min-h-80 sm:p-8 sm:text-base">
      {text}
    </div>
  );
}
