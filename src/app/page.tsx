"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  HardHat,
  Inbox,
  Loader2,
  MessageCircle,
  ReceiptText,
  Send,
  Settings,
  WalletCards,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PastePriceList } from "@/components/paste-price-list";
import { PilotAnalyticsDashboard } from "@/components/pilot-analytics-dashboard";
import { QuoteConfidenceIndicator } from "@/components/quote-confidence-indicator";
import { demoMessages } from "@/lib/mock-data";
import type {
  AnalyticsEvent,
  AnalyticsFunnelStep,
  AnalyticsSummary,
  FailureEvent,
  FailureSummary,
} from "@/lib/pilot-analytics";
import { getQuotePricingStatus } from "@/lib/quote-confidence";
import type { ExtractedJob, InvoiceStatus, PriceCategory, PriceItem, Quote } from "@/lib/types";
import { calculateVatTotals, DEFAULT_VAT_RATE } from "@/lib/vat";

const nav = [
  { id: "inbox", label: "Quote", icon: Inbox },
  { id: "pricing", label: "Prices", icon: WalletCards },
  { id: "dashboard", label: "Jobs", icon: ClipboardList },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
  { id: "settings", label: "Account", icon: Settings },
] as const;

type View = "dashboard" | "inbox" | "pricing" | "invoices" | "settings";

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
  messages?: { body: string | null; ai_summary: string | null; created_at: string }[] | null;
  quotes?:
    | {
        id: string;
        quote_number: string | null;
        subtotal: number | null;
        tax: number | null;
        total: number | null;
        vat_registered: boolean | null;
        vat_rate: number | null;
        status: string | null;
        quote_items?:
          | {
              description: string;
              quantity: number | string;
              unit_price: number | string;
              total: number | string;
            }[]
          | null;
      }[]
    | null;
  invoices?:
    | {
        id: string;
        invoice_number: string | null;
        total: number | null;
        status: string | null;
        due_date: string | null;
        created_at: string;
      }[]
    | null;
};

type SavedInvoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  status: InvoiceStatus;
  dueDate: string | null;
  createdAt: string;
  jobTitle: string;
  customerName: string | null;
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName: string;
  phone: string;
  address: string;
  vatRegistered: boolean;
  vatRate: number;
};

type BrowserSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
};

type ApiAuthResponse = {
  connected?: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
  profile?: UserProfile | null;
  session?: {
    access_token: string;
    refresh_token: string;
  } | null;
};

const AUTH_STORAGE_KEY = "sitegent_session";

const starterPriceItems: Omit<PriceItem, "id">[] = [
  {
    name: "River sand",
    category: "material",
    unit: "per cube",
    unitPrice: 450,
    vatRate: 0.15,
    aliases: ["sand", "river sand", "cubes river sand"],
    notes: "Starter price. Replace with your real supplier price.",
    active: true,
  },
  {
    name: "19mm stone",
    category: "material",
    unit: "per cube",
    unitPrice: 520,
    vatRate: 0.15,
    aliases: ["stone", "19mm stone", "gravel"],
    notes: "Starter price. Replace with your real supplier price.",
    active: true,
  },
  {
    name: "Tipper delivery",
    category: "delivery",
    unit: "fixed",
    unitPrice: 650,
    vatRate: 0.15,
    aliases: ["delivery", "transport", "tipper delivery", "diesel"],
    notes: "Starter local delivery charge.",
    active: true,
  },
  {
    name: "Labour",
    category: "labour",
    unit: "per hour",
    unitPrice: 350,
    vatRate: 0.15,
    aliases: ["labour", "labor", "workmanship"],
    notes: "Starter labour rate.",
    active: true,
  },
  {
    name: "Call-out fee",
    category: "fee",
    unit: "fixed",
    unitPrice: 250,
    vatRate: 0.15,
    aliases: ["call out", "call-out", "site visit"],
    notes: "Starter site visit fee.",
    active: true,
  },
];

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
}

function friendlyFetchError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "SiteGent took too long to respond. Please try again.";
  }

  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Your browser could not reach SiteGent. Refresh the page, sign in again, and try once more.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

async function fetchJsonWithRetry<T>(url: string, init: RequestInit) {
  let lastError: unknown;
  const urls =
    typeof window === "undefined" || url.startsWith("http")
      ? [url]
      : [url, new URL(url, window.location.origin).toString()];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const candidateUrl of urls) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6_000);

      try {
        const response = await fetch(candidateUrl, {
          ...init,
          cache: "no-store",
          signal: init.signal ?? controller.signal,
        });
        const data = (await response.json()) as T;

        return { response, data };
      } catch (error) {
        lastError = error;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw lastError;
}

async function withUiTimeout<T>(promise: Promise<T>, ms = 45_000) {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new DOMException("Request timed out", "AbortError")), ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export default function Home() {
  const accountsEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [active, setActive] = useState<View>("inbox");
  const [message, setMessage] = useState("");
  const [extracted, setExtracted] = useState<ExtractedJob | null>(null);
  const [quoteItems, setQuoteItems] = useState<Quote["items"]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("ready");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [savedJobsLoading, setSavedJobsLoading] = useState(false);
  const [savedJobsMessage, setSavedJobsMessage] = useState("");
  const [savedJobsError, setSavedJobsError] = useState("");
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesMessage, setInvoicesMessage] = useState("");
  const [invoicesError, setInvoicesError] = useState("");
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingMessage, setPricingMessage] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [analyticsFunnel, setAnalyticsFunnel] = useState<AnalyticsFunnelStep[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsRecent, setAnalyticsRecent] = useState<AnalyticsEvent[]>([]);
  const [failureSummary, setFailureSummary] = useState<FailureSummary | null>(null);
  const [recentFailures, setRecentFailures] = useState<FailureEvent[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  const generatedQuote = useMemo<Quote | null>(() => {
    if (!extracted) return null;
    const totals = calculateVatTotals(quoteItems, {
      vatRegistered: profile?.vatRegistered ?? false,
      vatRate: profile?.vatRate ?? DEFAULT_VAT_RATE,
    });

    return {
      id: "quote-ai",
      jobId: "job-ai",
      quoteNumber: "Assigned when saved",
      ...totals,
      status: "draft",
      items: quoteItems,
    };
  }, [extracted, profile?.vatRate, profile?.vatRegistered, quoteItems]);

  const authHeaders = useCallback((currentSession: BrowserSession | null = session): Record<string, string> => {
    return currentSession?.access_token ? { authorization: `Bearer ${currentSession.access_token}` } : {};
  }, [session]);

  const trackEvent = useCallback(async (event: string, metadata?: Record<string, string | number | boolean | null>) => {
    if (!session) return;

    try {
      await fetchJsonWithRetry<{ error?: string }>("/api/analytics", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ event, metadata }),
      });
    } catch {
      // Usage tracking should never interrupt a contractor's workflow.
    }
  }, [authHeaders, session]);

  const loadAnalytics = useCallback(async (currentSession: BrowserSession | null = session) => {
    if (!currentSession) {
      setAnalyticsFunnel([]);
      setAnalyticsSummary(null);
      setAnalyticsRecent([]);
      setFailureSummary(null);
      setRecentFailures([]);
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const { response, data } = await fetchJsonWithRetry<{
        error?: string;
        funnel?: AnalyticsFunnelStep[];
        summary?: AnalyticsSummary;
        recent?: AnalyticsEvent[];
        failures?: FailureSummary;
        recentFailures?: FailureEvent[];
      }>("/api/analytics", {
        headers: authHeaders(currentSession),
      });

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load pilot signals.");
      }

      setAnalyticsFunnel(data.funnel ?? []);
      setAnalyticsSummary(data.summary ?? null);
      setAnalyticsRecent(data.recent ?? []);
      setFailureSummary(data.failures ?? null);
      setRecentFailures(data.recentFailures ?? []);
    } catch (error) {
      setAnalyticsError(friendlyFetchError(error));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [authHeaders, session]);

  const loadProfile = useCallback(async (currentSession: BrowserSession | null = session) => {
    if (!currentSession) {
      setProfile(null);
      return;
    }

    setAuthError("");

    try {
      const { response, data } = await fetchJsonWithRetry<{
        needsOnboarding?: boolean;
        error?: string;
        profile?: UserProfile;
      }>("/api/auth/me", {
        headers: authHeaders(currentSession),
      });

      if (data.needsOnboarding) {
        setProfile(null);
        setAuthMessage("Create your company profile to start saving real jobs.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load your profile.");
      }

      setProfile(data.profile ?? null);
      setAuthMessage("");
    } catch (error) {
      setProfile(null);
      setAuthMessage("");
      setAuthError(error instanceof Error ? error.message : "Could not load your profile.");
    }
  }, [authHeaders, session]);

  async function loadSavedJobs(currentSession: BrowserSession | null = session) {
    setSavedJobsLoading(true);
    setSavedJobsError("");
    try {
      const { response, data } = await fetchJsonWithRetry<{
        connected?: boolean;
        message?: string;
        error?: string;
        jobs?: SavedJob[];
      }>("/api/saved-jobs", {
        headers: authHeaders(currentSession),
      });
      setSupabaseConnected(Boolean(data.connected));
      setSavedJobs(data.jobs ?? []);
      setSavedJobsMessage(data.message ?? "");
      if (!response.ok) {
        setSavedJobsError(data.error ?? "Could not load saved jobs.");
      }
    } catch (error) {
      setSupabaseConnected(false);
      setSavedJobsError(friendlyFetchError(error));
    } finally {
      setSavedJobsLoading(false);
    }
  }

  const loadInvoices = useCallback(async (currentSession: BrowserSession | null = session) => {
    if (!currentSession) {
      setSavedInvoices([]);
      return;
    }

    setInvoicesLoading(true);
    setInvoicesError("");

    try {
      const { response, data } = await fetchJsonWithRetry<{
        connected?: boolean;
        message?: string;
        error?: string;
        invoices?: SavedInvoice[];
      }>("/api/invoices", {
        headers: authHeaders(currentSession),
      });

      setSavedInvoices(data.invoices ?? []);
      setInvoicesMessage(data.message ?? "");

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load invoices.");
      }
    } catch (error) {
      setInvoicesError(friendlyFetchError(error));
    } finally {
      setInvoicesLoading(false);
    }
  }, [authHeaders, session]);

  const loadPriceItems = useCallback(async (currentSession: BrowserSession | null = session) => {
    if (!currentSession) {
      setPriceItems([]);
      return;
    }

    setPricingLoading(true);
    setPricingError("");

    try {
      const response = await fetch("/api/pricing", {
        headers: authHeaders(currentSession),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load price list.");
      }

      setPriceItems(data.priceItems ?? []);
      setPricingMessage(data.connected ? "" : data.message ?? "");
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Could not load price list.");
    } finally {
      setPricingLoading(false);
    }
  }, [authHeaders, session]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSession() {
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
      const storedSession = stored ? (JSON.parse(stored) as BrowserSession) : null;

      if (cancelled) return;

      setSession(storedSession);
      setAuthReady(true);
      if (storedSession) {
        await loadProfile(storedSession);
        await loadPriceItems(storedSession);
        await loadInvoices(storedSession);
        await loadAnalytics(storedSession);
      }
    }

    void loadInitialSession().catch(() => {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setSession(null);
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [loadAnalytics, loadInvoices, loadProfile, loadPriceItems]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    async function loadInitialSavedJobs() {
      setSavedJobsLoading(true);
      setSavedJobsError("");
      try {
        const { response, data } = await fetchJsonWithRetry<{
          connected?: boolean;
          message?: string;
          error?: string;
          jobs?: SavedJob[];
        }>("/api/saved-jobs", {
          headers: authHeaders(),
        });
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
        setSavedJobsError(friendlyFetchError(error));
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
  }, [authReady, authHeaders, session?.access_token]);

  function fillDemo(label = demoMessages[0].label) {
    const demo = demoMessages.find((item) => item.label === label) ?? demoMessages[0];
    setMessage(demo.body);
    setExtracted(null);
    setQuoteItems([]);
    setSaveMessage("");
    setSaveError("");
    setActive("inbox");
  }

  async function runExtraction() {
    setLoading(true);
    setSaveError("");
    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not extract the job.");
      setExtracted(data.job);
      setQuoteItems(data.job.quoteItems ?? []);
      setMode(data.mode);
      setSaveMessage("");
      setSaveError("");
      setActive("inbox");
      await loadAnalytics();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not extract the job.");
    } finally {
      setLoading(false);
    }
  }

  function updateQuoteItem(index: number, field: "description" | "quantity" | "unitPrice", value: string) {
    setQuoteItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "description") {
          return { ...item, description: value, pricingSource: "manual", confidence: "medium", pricingStatus: item.unitPrice > 0 ? "estimated" : "needs_review" };
        }

        const numeric = Number(value);
        const safeValue = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
        const nextItem = { ...item, [field]: safeValue };

        return {
          ...nextItem,
          total: Number((nextItem.quantity * nextItem.unitPrice).toFixed(2)),
          pricingSource: "manual",
          confidence: nextItem.unitPrice > 0 ? "medium" : "low",
          pricingStatus: nextItem.unitPrice > 0 ? "estimated" : "needs_review",
        };
      }),
    );
  }

  function addQuoteItem() {
    setQuoteItems((current) => [
      ...current,
      {
        description: "New quote line",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        pricingSource: "manual",
        confidence: "low",
        pricingStatus: "needs_review",
      },
    ]);
  }

  function removeQuoteItem(index: number) {
    setQuoteItems((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  async function saveOperationsPack() {
    if (!extracted || !generatedQuote) return;

    setSaveLoading(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const response = await fetch("/api/operations/save", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
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
        setSaveMessage(data.message ?? "Saving is temporarily unavailable.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Could not save job.");
      }

      setSupabaseConnected(true);
      setSaveMessage(data.message ?? "Job saved.");
      await loadSavedJobs();
      await loadInvoices();
      await loadAnalytics();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save job.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    if (!accountsEnabled) {
      setAuthError("Accounts are temporarily unavailable.");
      return;
    }

    setAuthError("");
    setAuthMessage("");

    try {
      const { response, data } = await fetchJsonWithRetry<ApiAuthResponse>("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Could not sign in.");
      }

      const nextSession: BrowserSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      };

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setAuthMessage("Signed in. Loading your workspace...");
      await loadProfile(nextSession);
      await loadPriceItems(nextSession);
      await loadSavedJobs(nextSession);
      await loadInvoices(nextSession);
      await loadAnalytics(nextSession);
    } catch (error) {
      setAuthError(friendlyFetchError(error));
    }
  }

  async function signUp(email: string, password: string, companyInput?: { name: string; companyName: string; phone: string; address: string }) {
    if (!accountsEnabled) {
      setAuthError("Accounts are temporarily unavailable.");
      return;
    }

    setAuthError("");
    setAuthMessage("");

    try {
      const { response, data } = await fetchJsonWithRetry<ApiAuthResponse>("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, ...companyInput }),
      });

      if (!response.ok) {
        throw new Error(data.error ?? "Could not create your account.");
      }

      if (!data.session) {
        setAuthMessage("Account created. Check your email, then sign in.");
        return;
      }

      const nextSession: BrowserSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      };

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      if (data.profile) {
        setProfile(data.profile);
        setAuthMessage("Account created. Step 2: add your prices so SiteGent can quote from your rates.");
        setActive("pricing");
        await loadPriceItems(nextSession);
        await loadInvoices(nextSession);
        await loadAnalytics(nextSession);
      } else {
        setAuthMessage("Account created. Add your company details next.");
        setActive("settings");
        await loadProfile(nextSession);
      }
    } catch (error) {
      setAuthError(friendlyFetchError(error));
    }
  }

  async function signOut() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
    setProfile(null);
    setSavedJobs([]);
    setSavedInvoices([]);
    setPriceItems([]);
    setSavedJobsMessage("");
    setAuthMessage("Signed out.");
  }

  async function resetBrowserSession() {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith("sb-") || key.toLowerCase().includes("supabase") || key.toLowerCase().includes("sitegent")) {
          storage.removeItem(key);
        }
      }
    }

    window.location.assign("/");
  }

  async function onboardUser(input: { name: string; companyName: string; phone: string; address: string }) {
    const latestSession = session;

    if (!latestSession) {
      setAuthError("Sign in before creating a company profile.");
      return;
    }

    setAuthError("");
    setAuthMessage("");

    try {
      const { response, data } = await fetchJsonWithRetry<{
        connected?: boolean;
        error?: string;
        profile?: UserProfile;
      }>("/api/auth/onboard", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders(latestSession) },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(data.error ?? "Could not create company profile.");
      }

      setProfile(data.profile ?? null);
      setAuthMessage("Company profile created. Step 2: add your prices.");
      setActive("pricing");
      await loadSavedJobs();
      await loadPriceItems(latestSession);
      await loadInvoices(latestSession);
      await loadAnalytics(latestSession);
    } catch (error) {
      try {
        const { response, data } = await fetchJsonWithRetry<{
          profile?: UserProfile;
          needsOnboarding?: boolean;
          error?: string;
        }>("/api/auth/me", {
          headers: authHeaders(latestSession),
        });

        if (response.ok && data.profile) {
          setProfile(data.profile);
          setAuthMessage("Company profile is ready. You can now add prices.");
          setAuthError("");
          await loadPriceItems(latestSession);
          return;
        }
      } catch {
        // Keep the original error below so the user sees the real next action.
      }

      setAuthMessage("");
      setAuthError(friendlyFetchError(error));
    }
  }

  async function saveVatSettings(vatRegistered: boolean, vatPercentage: number) {
    const latestSession = session;

    if (!latestSession || !profile) {
      throw new Error("Sign in before changing VAT settings.");
    }

    const vatRate = vatPercentage / 100;
    const { response, data } = await fetchJsonWithRetry<{
      error?: string;
      message?: string;
      company?: { vatRegistered: boolean; vatRate: number };
    }>("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", ...authHeaders(latestSession) },
      body: JSON.stringify({ vatRegistered, vatRate }),
    });

    if (!response.ok || !data.company) {
      throw new Error(data.error ?? "Could not save VAT settings.");
    }

    setProfile({
      ...profile,
      vatRegistered: data.company.vatRegistered,
      vatRate: data.company.vatRate,
    });
    setAuthMessage(data.message ?? "VAT settings saved.");
  }

  async function addPriceItem(input: Omit<PriceItem, "id">) {
    setPricingLoading(true);
    setPricingError("");
    setPricingMessage("");

    try {
      const response = await fetch("/api/pricing", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify(input),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not add price item.");
      }

      setPricingMessage("Price item added.");
      await loadPriceItems();
      await loadAnalytics();
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Could not add price item.");
    } finally {
      setPricingLoading(false);
    }
  }

  async function importPriceItems(items: Omit<PriceItem, "id">[]) {
    setPricingLoading(true);
    setPricingError("");
    setPricingMessage("");

    try {
      const response = await fetch("/api/pricing", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not import price list.");
      }

      setPricingMessage(`${data.imported ?? items.length} price items imported.`);
      await loadPriceItems();
      await loadAnalytics();
      return true;
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Could not import price list.");
      return false;
    } finally {
      setPricingLoading(false);
    }
  }

  async function addStarterPrices() {
    setPricingLoading(true);
    setPricingError("");
    setPricingMessage("");

    try {
      for (const item of starterPriceItems) {
        const response = await fetch("/api/pricing", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders() },
          body: JSON.stringify(item),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Could not add starter prices.");
        }
      }

      setPricingMessage("Starter prices added. Review them and replace with your real charges.");
      await loadPriceItems();
      await loadAnalytics();
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Could not add starter prices.");
    } finally {
      setPricingLoading(false);
    }
  }

  async function updatePriceItem(id: string, updates: Partial<Omit<PriceItem, "id">>) {
    setPricingLoading(true);
    setPricingError("");
    setPricingMessage("");

    try {
      const response = await fetch("/api/pricing", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update price item.");
      }

      setPricingMessage("Price item updated.");
      await loadPriceItems();
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Could not update price item.");
    } finally {
      setPricingLoading(false);
    }
  }

  async function deletePriceItem(id: string) {
    setPricingLoading(true);
    setPricingError("");
    setPricingMessage("");

    try {
      const response = await fetch("/api/pricing", {
        method: "DELETE",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete price item.");
      }

      setPricingMessage("Price item deleted.");
      await loadPriceItems();
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Could not delete price item.");
    } finally {
      setPricingLoading(false);
    }
  }

  async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
    setInvoicesLoading(true);
    setInvoicesError("");
    setInvoicesMessage("");

    try {
      const { response, data } = await fetchJsonWithRetry<{ error?: string; invoice?: SavedInvoice }>("/api/invoices", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, status }),
      });

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update invoice.");
      }

      setInvoicesMessage(status === "paid" ? "Invoice marked paid." : "Invoice updated.");
      await loadInvoices();
    } catch (error) {
      setInvoicesError(friendlyFetchError(error));
    } finally {
      setInvoicesLoading(false);
    }
  }

  async function exportQuote(id: string) {
    setSavedJobsError("");

    try {
      const response = await fetch(`/api/documents/quote?id=${encodeURIComponent(id)}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Could not export quote." }));
        throw new Error(data.error ?? "Could not export quote.");
      }

      const html = await response.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
      await loadAnalytics();
    } catch (error) {
      setSavedJobsError(friendlyFetchError(error));
    }
  }

  async function exportInvoice(id: string) {
    setInvoicesError("");

    try {
      const response = await fetch(`/api/documents/invoice?id=${encodeURIComponent(id)}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Could not export invoice." }));
        throw new Error(data.error ?? "Could not export invoice.");
      }

      const html = await response.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
      await loadAnalytics();
    } catch (error) {
      setInvoicesError(friendlyFetchError(error));
    }
  }

  async function copyPaymentRequest(invoice: SavedInvoice) {
    const text = `Hi ${invoice.customerName ?? "there"}, your invoice ${invoice.invoiceNumber} is ready. Amount due: ${money(
      invoice.total,
    )}. Please reply with proof of payment once paid.`;

    try {
      await navigator.clipboard.writeText(text);
      setInvoicesMessage("Payment request copied. Paste it into WhatsApp.");
      void trackEvent("payment_request_copied", { invoiceId: invoice.id, total: invoice.total });
    } catch {
      setInvoicesError("Could not copy payment request. Select and copy the invoice details manually.");
    }
  }

  async function recordPayment(invoice: SavedInvoice) {
    setInvoicesLoading(true);
    setInvoicesError("");
    setInvoicesMessage("");

    try {
      const { response, data } = await fetchJsonWithRetry<{ error?: string; message?: string }>("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ invoiceId: invoice.id, amount: invoice.total, status: "paid" }),
      });

      if (!response.ok) {
        throw new Error(data.error ?? "Could not record payment.");
      }

      setInvoicesMessage(data.message ?? "Payment recorded.");
      await loadInvoices();
      await loadAnalytics();
    } catch (error) {
      setInvoicesError(friendlyFetchError(error));
    } finally {
      setInvoicesLoading(false);
    }
  }

  async function sendFeedback(input: { rating: "good" | "ok" | "bad"; message: string }) {
    setFeedbackMessage("");
    setFeedbackError("");

    try {
      const { response, data } = await fetchJsonWithRetry<{ error?: string; message?: string }>("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(data.error ?? "Could not send feedback.");
      }

      setFeedbackMessage(data.message ?? "Feedback sent.");
      await loadAnalytics();
    } catch (error) {
      setFeedbackError(friendlyFetchError(error));
    }
  }

  const activeItem = nav.find((item) => item.id === active) ?? nav[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8fa] text-[#111827]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] min-w-0 flex-col lg:flex-row">
        <aside className="sticky top-0 z-30 w-full min-w-0 border-b border-[#e5e7eb] bg-white/90 px-3 py-3 shadow-sm backdrop-blur sm:px-4 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6 lg:shadow-none">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:block">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-10 place-items-center rounded-lg bg-[#111827] text-white shadow-sm">
                <HardHat size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight">SiteGent</p>
                <p className="text-xs font-semibold text-[#6b7280]">Quote ops for contractors</p>
              </div>
            </div>
          </div>
          <nav className="mt-4 grid grid-cols-3 gap-1.5 pb-1 min-[420px]:grid-cols-4 sm:flex sm:flex-wrap lg:mt-8 lg:flex-col">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-xs font-bold transition sm:justify-start sm:px-3 sm:text-sm lg:gap-3 ${
                    active === item.id
                      ? "bg-[#111827] text-white shadow-sm"
                      : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
                  }`}
                  title={item.label}
                >
                  <Icon className="shrink-0" size={18} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <p className="mt-8 hidden text-sm font-semibold leading-6 text-[#6b7280] lg:block">
            Paste a WhatsApp job. Check the quote. Save and export.
          </p>
        </aside>

        <section className="min-w-0 flex-1 px-3 pb-6 pt-28 sm:px-6 sm:pt-6 lg:px-8 lg:py-7">
          <div className="mb-5 flex min-w-0 flex-col gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Workspace</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#111827]">{activeItem.label}</h1>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <span className="rounded-full border border-[#dcfce7] bg-[#f0fdf4] px-3 py-1 text-xs font-black text-[#166534]">Private workspace</span>
              <span className="rounded-full border border-[#fef3c7] bg-[#fffbeb] px-3 py-1 text-xs font-black text-[#92400e]">Drafts need review</span>
            </div>
          </div>
          <FirstRunWizard
            session={session}
            profile={profile}
            priceItems={priceItems}
            extracted={extracted}
            savedJobs={savedJobs}
            setActive={setActive}
          />
          {active === "dashboard" && (
            <Dashboard
              session={session}
              savedJobs={savedJobs}
              savedJobsLoading={savedJobsLoading}
              savedJobsMessage={savedJobsMessage}
              savedJobsError={savedJobsError}
              supabaseConnected={supabaseConnected}
              reloadSavedJobs={loadSavedJobs}
              exportInvoice={exportInvoice}
              exportQuote={exportQuote}
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
              session={session}
              profile={profile}
              priceItems={priceItems}
              fillDemo={fillDemo}
              updateQuoteItem={updateQuoteItem}
              addQuoteItem={addQuoteItem}
              removeQuoteItem={removeQuoteItem}
              saveOperationsPack={saveOperationsPack}
              saveLoading={saveLoading}
              saveMessage={saveMessage}
              saveError={saveError}
              supabaseConnected={supabaseConnected}
              setActive={setActive}
            />
          )}
          {active === "pricing" && (
            <PricingView
              session={session}
              profile={profile}
              items={priceItems}
              loading={pricingLoading}
              message={pricingMessage}
              error={pricingError}
              addPriceItem={addPriceItem}
              importPriceItems={importPriceItems}
              addStarterPrices={addStarterPrices}
              updatePriceItem={updatePriceItem}
              deletePriceItem={deletePriceItem}
              reload={() => loadPriceItems()}
            />
          )}
          {active === "invoices" && (
            <InvoicesView
              quote={generatedQuote}
              extracted={extracted}
              savedInvoices={savedInvoices}
              loading={invoicesLoading}
              message={invoicesMessage}
              error={invoicesError}
              reload={() => loadInvoices()}
              updateStatus={updateInvoiceStatus}
              exportInvoice={exportInvoice}
              copyPaymentRequest={copyPaymentRequest}
              recordPayment={recordPayment}
            />
          )}
          {active === "settings" && (
            <SettingsView
              supabaseEnabled={accountsEnabled}
              authReady={authReady}
              session={session}
              profile={profile}
              authMessage={authMessage}
              authError={authError}
              signIn={signIn}
              signUp={signUp}
              signOut={signOut}
              resetBrowserSession={resetBrowserSession}
              onboardUser={onboardUser}
              saveVatSettings={saveVatSettings}
              analyticsFunnel={analyticsFunnel}
              analyticsSummary={analyticsSummary}
              analyticsRecent={analyticsRecent}
              failureSummary={failureSummary}
              recentFailures={recentFailures}
              analyticsLoading={analyticsLoading}
              analyticsError={analyticsError}
              loadAnalytics={() => loadAnalytics()}
              feedbackMessage={feedbackMessage}
              feedbackError={feedbackError}
              sendFeedback={sendFeedback}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function FirstRunWizard({
  session,
  profile,
  priceItems,
  extracted,
  savedJobs,
  setActive,
}: {
  session: BrowserSession | null;
  profile: UserProfile | null;
  priceItems: PriceItem[];
  extracted: ExtractedJob | null;
  savedJobs: SavedJob[];
  setActive: (view: View) => void;
}) {
  const steps = [
    {
      label: "Create your company workspace",
      detail: session ? "Finish your company profile." : "Create an account and company profile.",
      done: Boolean(session && profile),
      action: session ? "Finish company profile" : "Create account",
      view: "settings" as View,
    },
    {
      label: "Add your real prices",
      detail: "Start with labour, call-out, materials, and delivery.",
      done: priceItems.length > 0,
      action: "Add prices",
      view: "pricing" as View,
    },
    {
      label: "Paste and check one job",
      detail: "Use a real WhatsApp request or the sample message.",
      done: Boolean(extracted),
      action: "Create first quote",
      view: "inbox" as View,
    },
    {
      label: "Save and export",
      detail: "Save the job, then export the quote or invoice.",
      done: savedJobs.length > 0,
      action: extracted ? "Save this job" : "Open saved jobs",
      view: extracted && savedJobs.length === 0 ? ("inbox" as View) : ("dashboard" as View),
    },
  ];
  const nextStep = steps.find((step) => !step.done);
  const completedSteps = steps.filter((step) => step.done).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  if (!nextStep) {
    return null;
  }

  return (
    <section className="mb-5 min-w-0 rounded-xl border border-[#d1fae5] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#166534]">Next step</p>
          <p className="mt-1 text-lg font-black tracking-tight">{nextStep.label}</p>
          <p className="mt-1 text-sm leading-6 text-[#6b7280]">{nextStep.detail}</p>
        </div>
        <button
          onClick={() => setActive(nextStep.view)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-black text-white hover:bg-[#1f2937] sm:w-auto"
        >
          {nextStep.action}
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ecfdf5]">
        <div className="h-full rounded-full bg-[#166534] transition-all" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function Dashboard({
  session,
  savedJobs,
  savedJobsLoading,
  savedJobsMessage,
  savedJobsError,
  supabaseConnected,
  reloadSavedJobs,
  exportInvoice,
  exportQuote,
}: {
  session: BrowserSession | null;
  savedJobs: SavedJob[];
  savedJobsLoading: boolean;
  savedJobsMessage: string;
  savedJobsError: string;
  supabaseConnected: boolean | null;
  reloadSavedJobs: () => Promise<void>;
  exportInvoice: (id: string) => Promise<void>;
  exportQuote: (id: string) => Promise<void>;
}) {
  return (
    <section className="grid min-w-0 gap-4 sm:gap-5">
      {!session && <StatusMessage tone="info" text="Sign in to save and see private company jobs." />}
      <SavedJobsSection
        signedIn={Boolean(session)}
        jobs={savedJobs}
        loading={savedJobsLoading}
        message={savedJobsMessage}
        error={savedJobsError}
        connected={supabaseConnected}
        reload={reloadSavedJobs}
        exportInvoice={exportInvoice}
        exportQuote={exportQuote}
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
  session,
  profile,
  priceItems,
  fillDemo,
  updateQuoteItem,
  addQuoteItem,
  removeQuoteItem,
  saveOperationsPack,
  saveLoading,
  saveMessage,
  saveError,
  supabaseConnected,
  setActive,
}: {
  message: string;
  setMessage: (value: string) => void;
  runExtraction: () => void;
  loading: boolean;
  extracted: ExtractedJob | null;
  quote: Quote | null;
  session: BrowserSession | null;
  profile: UserProfile | null;
  priceItems: PriceItem[];
  fillDemo: (label?: string) => void;
  updateQuoteItem: (index: number, field: "description" | "quantity" | "unitPrice", value: string) => void;
  addQuoteItem: () => void;
  removeQuoteItem: (index: number) => void;
  saveOperationsPack: () => Promise<void>;
  saveLoading: boolean;
  saveMessage: string;
  saveError: string;
  supabaseConnected: boolean | null;
  setActive: (view: View) => void;
}) {
  const hasWorkspace = Boolean(session && profile);
  const hasPrices = priceItems.length > 0;
  const canSave = hasWorkspace && hasPrices;
  const saveButtonText = !hasWorkspace ? "Set up account to save" : !hasPrices ? "Add prices to save" : "Save job and invoice";
  const matchedQuoteLines = quote?.items.filter((item) => getQuotePricingStatus(item) === "matched").length ?? 0;
  const estimatedQuoteLines = quote?.items.filter((item) => getQuotePricingStatus(item) === "estimated").length ?? 0;
  const reviewQuoteLines = quote?.items.filter((item) => getQuotePricingStatus(item) === "needs_review").length ?? 0;

  return (
    <section className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.18fr)]">
      <Panel title="Paste WhatsApp Job">
        <div className="space-y-4">
          {(!hasWorkspace || !hasPrices) && (
            <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
              <p className="text-sm font-black text-[#92400e]">
                {!hasWorkspace ? "Create your account before saving jobs." : "Add prices before saving real quotes."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!hasWorkspace && (
                  <button
                    onClick={() => setActive("settings")}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[#111827] px-3 text-sm font-black text-white hover:bg-[#1f2937]"
                  >
                    Create account
                  </button>
                )}
                {hasWorkspace && !hasPrices && (
                  <button
                    onClick={() => setActive("pricing")}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[#111827] px-3 text-sm font-black text-white hover:bg-[#1f2937]"
                  >
                    Add prices
                  </button>
                )}
              </div>
            </div>
          )}
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-48 w-full min-w-0 resize-none rounded-lg border border-[#d1d5db] bg-white p-3 text-sm leading-6 shadow-inner outline-none focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/15 sm:min-h-56 sm:p-4 sm:text-base sm:leading-7"
            placeholder="Paste the customer's WhatsApp message here. Example: Hi, I need a leaking shower pipe fixed tomorrow in Bela-Bela..."
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={runExtraction}
              disabled={loading || message.trim().length < 8}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-[#166534] px-4 text-sm font-black text-white hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:text-base"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Generate quote
            </button>
            <button
              onClick={() => fillDemo("Plumbing leak")}
              className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-md border border-[#d1d5db] bg-white px-4 text-sm font-bold text-[#111827] hover:bg-[#f9fafb] sm:w-auto sm:px-5 sm:text-base"
            >
              <WandSparkles size={18} />
              Try sample
            </button>
          </div>
          <p className="text-sm font-medium text-[#6b7280]">
            {extracted
              ? "Always review prices before sending."
              : "Ready when you are. Paste a WhatsApp message and generate a quote draft."}
          </p>
        </div>
      </Panel>

      <Panel title="Check And Save Quote">
        {extracted && quote ? (
          <div className="grid min-w-0 gap-4">
            <div className="min-w-0 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 sm:p-4">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#166534]">Job found</p>
                  <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{extracted.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#166534]">{extracted.summary}</p>
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

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
              <div className="min-w-0">
                <p className="mb-2 text-sm font-black">Editable Quote</p>
                <p className="mb-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-2 text-xs font-bold leading-5 text-[#92400e]">
                  Check quantities, prices, VAT, delivery, and dates before sending to a customer.
                </p>
                <div className="mb-3 grid gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3 text-sm leading-6 text-[#6b7280] sm:grid-cols-3">
                  <div>
                    <p className="font-black text-[#166534]">Matched company price</p>
                    <p>
                      {hasPrices
                        ? `${matchedQuoteLines} line${matchedQuoteLines === 1 ? "" : "s"} matched your company prices.`
                        : "Add prices so SiteGent can quote from your real rates."}
                    </p>
                  </div>
                  <div>
                    <p className="font-black text-[#92400e]">Estimated price</p>
                    <p>{estimatedQuoteLines} line{estimatedQuoteLines === 1 ? "" : "s"} use AI or manually edited prices.</p>
                  </div>
                  <div>
                    <p className="font-black text-[#b91c1c]">Needs review</p>
                    <p>
                      {reviewQuoteLines > 0
                        ? `${reviewQuoteLines} line${reviewQuoteLines === 1 ? "" : "s"} need checking before you send.`
                        : "No estimated lines remain. Give the full quote one final check."}
                    </p>
                  </div>
                </div>
                <div className="grid min-w-0 gap-2">
                  {quote.items.map((item, index) => {
                    return (
                      <div
                        key={`${item.description}-${index}`}
                        className="grid min-w-0 gap-3 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-sm"
                      >
                        <QuoteConfidenceIndicator item={item} />
                        <label className="grid min-w-0 gap-1 text-xs font-black text-[#516158]">
                          Description
                          <input
                            value={item.description}
                            onChange={(event) => updateQuoteItem(index, "description", event.target.value)}
                            className="h-11 w-full min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#166534]"
                          />
                        </label>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(72px,0.7fr)_minmax(120px,1fr)_minmax(120px,1fr)]">
                          <label className="grid min-w-0 gap-1 text-xs font-black text-[#516158]">
                            Qty
                            <input
                              value={String(item.quantity)}
                              onChange={(event) => updateQuoteItem(index, "quantity", event.target.value)}
                              className="h-11 w-full min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#166534]"
                              inputMode="decimal"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-xs font-black text-[#516158]">
                            Unit price
                            <input
                              value={String(item.unitPrice)}
                              onChange={(event) => updateQuoteItem(index, "unitPrice", event.target.value)}
                              className="h-11 w-full min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#166534]"
                              inputMode="decimal"
                            />
                          </label>
                          <div className="grid min-w-0 gap-1 text-xs font-black text-[#516158]">
                            Total
                            <p className="grid min-h-11 min-w-0 items-center rounded-md bg-[#f3f4f6] px-3 text-right font-mono text-sm font-black text-[#111827]">
                              {money(item.total)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeQuoteItem(index)}
                          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 text-sm font-black text-[#991b1b] hover:bg-white sm:w-auto sm:justify-self-start"
                        >
                          Remove
                        </button>
                    </div>
                    );
                  })}
                  <button
                    onClick={addQuoteItem}
                    className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[#d1d5db] bg-white px-3 text-sm font-black text-[#111827] hover:bg-[#f9fafb]"
                  >
                    Add quote line
                  </button>
                </div>
                <div className="mt-3 min-w-0 rounded-lg bg-[#111827] p-3 text-white sm:p-4">
                  <div className="flex min-w-0 justify-between gap-3 text-sm text-[#c9d8d0]">
                    <span>Subtotal</span>
                    <span>{money(quote.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex min-w-0 justify-between gap-3 text-sm text-[#c9d8d0]">
                    <span>
                      {quote.vatRegistered
                        ? `VAT ${((quote.vatRate ?? DEFAULT_VAT_RATE) * 100).toFixed(2).replace(/\.?0+$/, "")}%`
                        : "VAT not charged"}
                    </span>
                    <span>{quote.vatRegistered ? money(quote.tax) : money(0)}</span>
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

            <div className="min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-sm sm:p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-black">Confirm and save job plus invoice</p>
                  <p className="mt-1 text-sm leading-6 text-[#69746f]">
                    Save the customer message, job card, quote, invoice, and review record to your private workspace.
                  </p>
                </div>
                <button
                  onClick={saveOperationsPack}
                  disabled={saveLoading || !canSave}
                  className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-[#166534] px-4 text-sm font-black text-white hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-5 sm:text-base"
                >
                  {saveLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {saveButtonText}
                </button>
              </div>
              {!canSave && (
                <div className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                  <p className="text-sm font-black text-[#101814]">
                    {!hasWorkspace ? "Set up your workspace to save this job." : "Add your prices before saving this job."}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#516158]">
                    {!hasWorkspace
                      ? "SiteGent needs your company profile so saved jobs and invoices stay private to your business."
                      : "Your price list keeps quotes tied to the rates your company actually charges."}
                  </p>
                  <button
                    onClick={() => setActive(!hasWorkspace ? "settings" : "pricing")}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#111827] px-3 text-sm font-black text-white hover:bg-[#1f2937] sm:w-auto"
                  >
                    {!hasWorkspace ? "Set up account" : "Add prices"}
                  </button>
                </div>
              )}
              {supabaseConnected === false && !saveMessage && (
                <StatusMessage tone="info" text="Saving is temporarily unavailable. Sign in again or contact SiteGent support." />
              )}
              {saveMessage && <StatusMessage tone={supabaseConnected ? "success" : "info"} text={saveMessage} />}
              {saveError && <StatusMessage tone="error" text={saveError} />}
            </div>
          </div>
        ) : (
          loading
            ? <LoadingBlock text="Reading the customer message and preparing a quote draft..." />
            : (
                <div>
                  {saveError && <StatusMessage tone="error" text={saveError} />}
                  <EmptyState text="Paste a WhatsApp job message, click Generate quote, edit the quote lines, then save the job." />
                </div>
              )
        )}
      </Panel>
    </section>
  );
}

function SavedJobsSection({
  signedIn,
  jobs,
  loading,
  message,
  error,
  connected,
  reload,
  exportInvoice,
  exportQuote,
}: {
  signedIn: boolean;
  jobs: SavedJob[];
  loading: boolean;
  message: string;
  error: string;
  connected: boolean | null;
  reload: () => Promise<void>;
  exportInvoice: (id: string) => Promise<void>;
  exportQuote: (id: string) => Promise<void>;
}) {
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  return (
    <Panel title="Saved Jobs">
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#516158]">
            {!signedIn
              ? "Sign in to see your saved jobs."
              : connected
                ? "Only your company can see these jobs."
                : "Saved jobs are temporarily unavailable."}
          </p>
          {message && <p className="mt-1 text-sm text-[#69746f]">{message}</p>}
        </div>
        <button
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d1d5db] bg-white px-4 text-sm font-black text-[#111827] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Inbox size={16} />}
          Refresh
        </button>
      </div>
      {error && <StatusMessage tone="error" text={error} />}
      {loading && (
        <LoadingBlock text="Loading saved jobs..." />
      )}
      {!loading && connected && jobs.length === 0 && (
        <EmptyState text="No saved jobs yet. Generate a quote, then click Save job and invoice." />
      )}
      {!loading && jobs.length > 0 && (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {jobs.map((job) => {
            const quote = job.quotes?.[0];
            const invoice = job.invoices?.[0];
            const messageBody = job.messages?.[0]?.body;
            const quoteTotal = Number(quote?.total ?? 0);
            const isOpen = openJobId === job.id;
            return (
              <article key={job.id} className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm transition hover:border-[#d1d5db] hover:shadow-md sm:p-4">
                <div className="flex min-w-0 flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:justify-between">
                  <div className="min-w-0">
                    <p className="font-black">{job.title}</p>
                    <p className="mt-1 text-sm text-[#6b7280]">
                      {job.customers?.name ?? "Customer"} - {job.location ?? "Location to confirm"}
                    </p>
                  </div>
                  <Badge>{job.status}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#6b7280]">{job.description}</p>
                <div className="mt-4 flex min-w-0 flex-wrap gap-2 text-xs font-black text-[#4b5563]">
                  <span className="min-w-0 rounded-full bg-[#f3f4f6] px-2.5 py-1">Urgency: {job.urgency}</span>
                  <span className="min-w-0 rounded-full bg-[#f3f4f6] px-2.5 py-1">
                    Quote: {quoteTotal > 0 ? money(quoteTotal) : "Draft"}
                  </span>
                  {invoice && <span className="min-w-0 rounded-full bg-[#f3f4f6] px-2.5 py-1">Invoice: {invoice.status ?? "draft"}</span>}
                </div>
                <button
                  onClick={() => setOpenJobId(isOpen ? null : job.id)}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d1d5db] bg-white px-3 text-sm font-black text-[#111827] hover:bg-[#f9fafb]"
                >
                  {isOpen ? "Close job" : "Open job"}
                  <ArrowRight className={isOpen ? "rotate-90" : ""} size={16} />
                </button>
                {isOpen && (
                  <div className="mt-4 grid min-w-0 gap-3 border-t border-[#e5e7eb] pt-4">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <Info label="Customer" value={job.customers?.name ?? "Customer"} />
                      <Info label="Phone" value={job.customers?.phone ?? "No phone saved"} />
                      <Info label="Location" value={job.location ?? "Location to confirm"} />
                      <Info label="Saved" value={new Date(job.created_at).toLocaleDateString("en-ZA")} />
                    </div>

                    {messageBody && (
                      <div className="min-w-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                        <p className="text-sm font-black">Original WhatsApp message</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#6b7280]">{messageBody}</p>
                      </div>
                    )}

                    {quote && (
                      <div className="min-w-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-black">Quote {quote.quote_number ?? ""}</p>
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <Badge>{quote.status ?? "draft"}</Badge>
                            <button
                              onClick={() => void exportQuote(quote.id)}
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#111827] px-3 text-xs font-black text-white hover:bg-[#1f2937] sm:w-auto"
                            >
                              <Download size={14} />
                              Export quote
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid min-w-0 gap-2">
                          {(quote.quote_items ?? []).map((item, index) => {
                            const lineTotal = Number(item.total ?? 0);
                            return (
                              <div
                                key={`${item.description}-${index}`}
                                className="grid min-w-0 gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3 text-sm sm:grid-cols-[minmax(0,1fr)_80px_110px]"
                              >
                                <span className="min-w-0 font-bold text-[#101814]">{item.description}</span>
                                <span className="font-mono text-[#6b7280]">Qty {Number(item.quantity ?? 0)}</span>
                                <span className="font-mono font-black text-[#101814]">{money(lineTotal)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 rounded-lg bg-[#111827] p-3 text-white">
                          <div className="flex justify-between gap-3 text-sm text-[#c9d8d0]">
                            <span>Subtotal</span>
                            <span>{money(Number(quote.subtotal ?? 0))}</span>
                          </div>
                          <div className="mt-1 flex justify-between gap-3 text-sm text-[#c9d8d0]">
                            <span>
                              {quote.vat_registered
                                ? `VAT ${(Number(quote.vat_rate ?? DEFAULT_VAT_RATE) * 100).toFixed(2).replace(/\.?0+$/, "")}%`
                                : "VAT not charged"}
                            </span>
                            <span>{quote.vat_registered ? money(Number(quote.tax ?? 0)) : money(0)}</span>
                          </div>
                          <div className="mt-3 flex justify-between gap-3 text-lg font-black">
                            <span>Total</span>
                            <span>{money(quoteTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {invoice && (
                      <div className="min-w-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black">Invoice {invoice.invoice_number ?? ""}</p>
                            <p className="mt-1 text-sm text-[#6b7280]">
                              {money(Number(invoice.total ?? 0))} - {invoice.status ?? "draft"}
                            </p>
                          </div>
                          <button
                            onClick={() => void exportInvoice(invoice.id)}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#111827] px-3 text-sm font-black text-white hover:bg-[#1f2937] sm:w-auto"
                          >
                            <Download size={16} />
                            Export invoice
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function PricingView({
  session,
  profile,
  items,
  loading,
  message,
  error,
  addPriceItem,
  importPriceItems,
  addStarterPrices,
  updatePriceItem,
  deletePriceItem,
  reload,
}: {
  session: BrowserSession | null;
  profile: UserProfile | null;
  items: PriceItem[];
  loading: boolean;
  message: string;
  error: string;
  addPriceItem: (input: Omit<PriceItem, "id">) => Promise<void>;
  importPriceItems: (items: Omit<PriceItem, "id">[]) => Promise<boolean>;
  addStarterPrices: () => Promise<void>;
  updatePriceItem: (id: string, updates: Partial<Omit<PriceItem, "id">>) => Promise<void>;
  deletePriceItem: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PriceCategory>("material");
  const [unit, setUnit] = useState("each");
  const [unitPrice, setUnitPrice] = useState("");
  const [aliases, setAliases] = useState("");
  const [notes, setNotes] = useState("");

  async function submitPriceItem() {
    const parsedPrice = Number(unitPrice);

    if (!name || !unit || !Number.isFinite(parsedPrice)) {
      return;
    }

    await addPriceItem({
      name,
      category,
      unit,
      unitPrice: parsedPrice,
      vatRate: 0.15,
      aliases: aliases
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: notes || null,
      active: true,
    });

    setName("");
    setCategory("material");
    setUnit("each");
    setUnitPrice("");
    setAliases("");
    setNotes("");
  }

  return (
    <section className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Panel title="Company Price List">
        <div className="grid min-w-0 gap-4">
          {!session && <StatusMessage tone="info" text="Sign in and create a company profile before adding prices." />}
          {session && !profile && <StatusMessage tone="info" text="Create your company profile before adding prices." />}
          {session && profile && (
            <>
              <p className="text-sm leading-6 text-[#516158]">
                Add the prices your company charges. SiteGent will use matching entries when it drafts quotes.
              </p>
              <PastePriceList loading={loading} onImport={importPriceItems} />
              {items.length === 0 && (
                <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                  <p className="text-sm font-black">Start faster</p>
                    <p className="mt-1 text-sm leading-6 text-[#92400e]">
                    Add starter prices for sand, stone, delivery, labour, and call-out fees. You can change them after.
                  </p>
                  <button
                    onClick={() => void addStarterPrices()}
                    disabled={loading}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#111827] px-4 text-sm font-black text-white hover:bg-[#1f2937] disabled:opacity-70 sm:w-auto"
                  >
                    Add starter prices
                  </button>
                </div>
              )}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold">
                  Item name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 outline-none focus:border-[#166534]"
                    placeholder="River sand"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Category
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as PriceCategory)}
                    className="h-11 min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 outline-none focus:border-[#166534]"
                  >
                    {["material", "labour", "delivery", "service", "fee", "other"].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Unit
                  <input
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    className="h-11 min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 outline-none focus:border-[#166534]"
                    placeholder="per cube"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Unit price
                  <input
                    value={unitPrice}
                    onChange={(event) => setUnitPrice(event.target.value)}
                    className="h-11 min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 outline-none focus:border-[#166534]"
                    inputMode="decimal"
                    placeholder="450"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-bold">
                Aliases
                <input
                  value={aliases}
                  onChange={(event) => setAliases(event.target.value)}
                  className="h-11 min-w-0 rounded-md border border-[#d1d5db] bg-white px-3 outline-none focus:border-[#166534]"
                  placeholder="sand, river sand, cubes river sand"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-24 min-w-0 resize-none rounded-md border border-[#d1d5db] bg-white p-3 outline-none focus:border-[#166534]"
                  placeholder="Supplier, minimum quantity, delivery notes..."
                />
              </label>
              <button
                onClick={() => void submitPriceItem()}
                disabled={loading || !name || !unit || !unitPrice}
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#166534] px-4 text-sm font-black text-white hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {loading ? "Saving..." : "Add price item"}
              </button>
            </>
          )}
          {message && <StatusMessage tone="success" text={message} />}
          {error && <StatusMessage tone="error" text={error} />}
        </div>
      </Panel>

      <Panel title="Saved Prices">
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[#516158]">
              Use clear names and aliases so SiteGent can match customer messages to your real charges.
            </p>
            <button
              onClick={() => void reload()}
              disabled={loading || !session}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[#d1d5db] bg-white px-4 text-sm font-black text-[#111827] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              Refresh
            </button>
          </div>
          {loading && (
            <LoadingBlock text="Loading price list..." />
          )}
          {!loading && items.length === 0 && (
            <EmptyState text="No prices yet. Add river sand, stone, delivery, labour, call-out fees, and other common charges." />
          )}
          {!loading && items.length > 0 && (
            <div className="grid min-w-0 gap-3">
              {items.map((item) => (
                <article key={item.id} className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm transition hover:border-[#d1d5db] sm:p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="font-black">{item.name}</p>
                        <Badge>{item.category}</Badge>
                        {!item.active && <Badge>inactive</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-bold text-[#516158]">
                        {money(item.unitPrice)} / {item.unit}
                      </p>
                      {item.aliases.length > 0 && (
                        <p className="mt-2 text-xs leading-5 text-[#69746f]">Aliases: {item.aliases.join(", ")}</p>
                      )}
                      {item.notes && <p className="mt-2 text-sm leading-6 text-[#516158]">{item.notes}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:w-36">
                      <button
                        onClick={() => void updatePriceItem(item.id, { active: !item.active })}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-[#d1d5db] bg-white px-3 text-sm font-black text-[#111827] hover:bg-[#f9fafb] disabled:opacity-70"
                      >
                        {item.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => void deletePriceItem(item.id)}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 text-sm font-black text-[#991b1b] hover:bg-white disabled:opacity-70"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </section>
  );
}

function InvoicesView({
  quote,
  extracted,
  savedInvoices,
  loading,
  message,
  error,
  reload,
  updateStatus,
  exportInvoice,
  copyPaymentRequest,
  recordPayment,
}: {
  quote: Quote | null;
  extracted: ExtractedJob | null;
  savedInvoices: SavedInvoice[];
  loading: boolean;
  message: string;
  error: string;
  reload: () => void;
  updateStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  exportInvoice: (id: string) => Promise<void>;
  copyPaymentRequest: (invoice: SavedInvoice) => Promise<void>;
  recordPayment: (invoice: SavedInvoice) => Promise<void>;
}) {
  const generated = quote && extracted ? [{ id: "invoice-ai", invoiceNumber: "Draft invoice", total: quote.total, status: "draft", dueDate: "After save" }] : [];
  const draftCount = savedInvoices.filter((invoice) => invoice.status === "draft").length;
  const sentCount = savedInvoices.filter((invoice) => invoice.status === "sent").length;
  const paidCount = savedInvoices.filter((invoice) => invoice.status === "paid").length;
  const paidValue = savedInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <Panel title="Invoices">
      <div className="mb-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Draft" value={String(draftCount)} />
        <MetricCard label="Sent" value={String(sentCount)} />
        <MetricCard label="Paid" value={String(paidCount)} />
        <MetricCard label="Paid value" value={money(paidValue)} />
      </div>
      <div className="mb-3 flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-sm text-[#6b7280] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Saved jobs create real draft invoices here. Review totals before sending anything to a customer.
        </p>
        <button
          onClick={reload}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-md border border-[#d1d5db] bg-white px-3 font-black text-[#111827] hover:bg-[#f9fafb] disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {message && <StatusMessage tone="info" text={message} />}
      {error && <StatusMessage tone="error" text={error} />}
      <div className="grid min-w-0 gap-3">
        {generated.map((item) => (
          <div key={item.id} className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm sm:p-4">
            <div className="flex min-w-0 flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
              <div className="min-w-0">
                <p className="font-black">{item.invoiceNumber}</p>
                <p className="text-sm text-[#69746f]">Save the job to create a real invoice number.</p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 min-[380px]:w-auto min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
                <Badge>{item.status}</Badge>
                <p className="min-w-0 font-mono font-black">{money(item.total)}</p>
              </div>
            </div>
          </div>
        ))}
        {savedInvoices.map((item) => (
          <div key={item.id} className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm transition hover:border-[#d1d5db] hover:shadow-md sm:p-4">
            <div className="flex min-w-0 flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
              <div className="min-w-0">
                <p className="font-black">{item.invoiceNumber}</p>
                <p className="text-sm text-[#6b7280]">{item.jobTitle}</p>
                <p className="text-xs text-[#6b7280]">
                  {item.customerName ?? "Customer"} · Due: {item.dueDate ?? "Not set"}
                </p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 min-[380px]:w-auto min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
                <Badge>{item.status}</Badge>
                <p className="min-w-0 font-mono font-black">{money(item.total)}</p>
                <button
                  onClick={() => void exportInvoice(item.id)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#111827] px-3 text-xs font-black text-white hover:bg-[#1f2937]"
                >
                  <Download size={14} />
                  Export
                </button>
                <button
                  onClick={() => void copyPaymentRequest(item)}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-[#d1d5db] px-3 text-xs font-black hover:bg-[#f9fafb]"
                >
                  Copy payment request
                </button>
                {item.status === "draft" && (
                  <button
                    onClick={() => void updateStatus(item.id, "sent")}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#d1d5db] px-3 text-xs font-black hover:bg-[#f9fafb]"
                  >
                    Mark sent
                  </button>
                )}
                {item.status !== "paid" && (
                  <button
                    onClick={() => void recordPayment(item)}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 text-xs font-black text-[#166534] hover:bg-[#dcfce7]"
                  >
                    Record paid
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!loading && savedInvoices.length === 0 && generated.length === 0 && (
          <EmptyState text="No invoices yet. Paste a WhatsApp message, generate a quote, then save the job." />
        )}
      </div>
    </Panel>
  );
}

function SettingsView({
  supabaseEnabled,
  authReady,
  session,
  profile,
  authMessage,
  authError,
  signIn,
  signUp,
  signOut,
  resetBrowserSession,
  onboardUser,
  saveVatSettings,
  analyticsFunnel,
  analyticsSummary,
  analyticsRecent,
  failureSummary,
  recentFailures,
  analyticsLoading,
  analyticsError,
  loadAnalytics,
  feedbackMessage,
  feedbackError,
  sendFeedback,
}: {
  supabaseEnabled: boolean;
  authReady: boolean;
  session: BrowserSession | null;
  profile: UserProfile | null;
  authMessage: string;
  authError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, companyInput?: { name: string; companyName: string; phone: string; address: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resetBrowserSession: () => Promise<void>;
  onboardUser: (input: { name: string; companyName: string; phone: string; address: string }) => Promise<void>;
  saveVatSettings: (vatRegistered: boolean, vatPercentage: number) => Promise<void>;
  analyticsFunnel: AnalyticsFunnelStep[];
  analyticsSummary: AnalyticsSummary | null;
  analyticsRecent: AnalyticsEvent[];
  failureSummary: FailureSummary | null;
  recentFailures: FailureEvent[];
  analyticsLoading: boolean;
  analyticsError: string;
  loadAnalytics: () => Promise<void>;
  feedbackMessage: string;
  feedbackError: string;
  sendFeedback: (input: { rating: "good" | "ok" | "bad"; message: string }) => Promise<void>;
}) {
  return (
    <section id="setup" className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <AuthPanel
        key={`${profile?.companyId ?? "guest"}-${profile?.vatRegistered ?? false}-${profile?.vatRate ?? DEFAULT_VAT_RATE}`}
        supabaseEnabled={supabaseEnabled}
        authReady={authReady}
        session={session}
        profile={profile}
        message={authMessage}
        error={authError}
        signIn={signIn}
        signUp={signUp}
        signOut={signOut}
        resetBrowserSession={resetBrowserSession}
        onboardUser={onboardUser}
        saveVatSettings={saveVatSettings}
      />
      <div className="grid min-w-0 content-start gap-4 sm:gap-5">
        <PilotFeedback
          session={session}
          message={feedbackMessage}
          error={feedbackError}
          sendFeedback={sendFeedback}
        />
        {session && profile && (
          <details className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm sm:p-5">
            <summary className="cursor-pointer text-base font-black tracking-tight text-[#111827] sm:text-lg">
              Pilot tools
            </summary>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              Optional tester signals. Contractors can ignore this during normal quoting.
            </p>
            <div className="mt-4">
              <PilotAnalyticsDashboard
                signedIn={Boolean(session)}
                funnel={analyticsFunnel}
                summary={analyticsSummary}
                recent={analyticsRecent}
                failures={failureSummary}
                recentFailures={recentFailures}
                loading={analyticsLoading}
                error={analyticsError}
                reload={loadAnalytics}
              />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function PilotFeedback({
  session,
  message,
  error,
  sendFeedback,
}: {
  session: BrowserSession | null;
  message: string;
  error: string;
  sendFeedback: (input: { rating: "good" | "ok" | "bad"; message: string }) => Promise<void>;
}) {
  const [rating, setRating] = useState<"good" | "ok" | "bad">("ok");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await sendFeedback({ rating, message: body });
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Pilot Feedback">
      <div className="grid min-w-0 gap-3 text-sm leading-6 text-[#516158]">
        <p className="font-bold text-[#101814]">Tell us where SiteGent got the job, price, quote, or invoice wrong.</p>
        {!session && <StatusMessage tone="info" text="Sign in to send feedback from this workspace." />}
        <div className="grid grid-cols-3 gap-2">
          {(["good", "ok", "bad"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setRating(item)}
              className={`h-10 rounded border px-3 text-sm font-black capitalize ${
                rating === item ? "border-[#101814] bg-[#101814] text-white" : "border-[#cfc6b5] bg-white text-[#516158]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-28 min-w-0 resize-none rounded border border-[#cfc6b5] bg-white p-3 outline-none focus:border-[#158052]"
          placeholder="Example: The delivery price was too low, or the app missed labour..."
        />
        <button
          onClick={() => void submit()}
          disabled={!session || submitting || body.trim().length < 8}
          className="inline-flex h-11 w-full items-center justify-center rounded bg-[#158052] px-4 text-sm font-black text-white hover:bg-[#116b44] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {submitting ? "Sending..." : "Send feedback"}
        </button>
        {message && <StatusMessage tone="success" text={message} />}
        {error && <StatusMessage tone="error" text={error} />}
      </div>
    </Panel>
  );
}

function AuthPanel({
  supabaseEnabled,
  authReady,
  session,
  profile,
  message,
  error,
  signIn,
  signUp,
  signOut,
  resetBrowserSession,
  onboardUser,
  saveVatSettings,
}: {
  supabaseEnabled: boolean;
  authReady: boolean;
  session: BrowserSession | null;
  profile: UserProfile | null;
  message: string;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, companyInput?: { name: string; companyName: string; phone: string; address: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resetBrowserSession: () => Promise<void>;
  onboardUser: (input: { name: string; companyName: string; phone: string; address: string }) => Promise<void>;
  saveVatSettings: (vatRegistered: boolean, vatPercentage: number) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [vatRegistered, setVatRegistered] = useState(profile?.vatRegistered ?? false);
  const [vatPercentage, setVatPercentage] = useState((profile?.vatRate ?? DEFAULT_VAT_RATE) * 100);
  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
  ];
  const passwordIsReady = passwordRules.every((rule) => rule.met);
  const canCreateAccount = Boolean(name.trim() && phone.trim() && email.trim() && passwordIsReady && companyName.trim());
  const canSignIn = Boolean(email.trim() && password.trim());

  async function submitAuth(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSubmitting(true);
    setPanelError("");
    try {
      if (mode === "signin") {
        await withUiTimeout(signIn(email, password));
      } else {
        await withUiTimeout(signUp(email, password, { name, companyName, phone, address }));
      }
    } catch (error) {
      setPanelError(friendlyFetchError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOnboarding(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSubmitting(true);
    setPanelError("");
    try {
      await withUiTimeout(onboardUser({ name, companyName, phone, address }));
    } catch (error) {
      setPanelError(friendlyFetchError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVatSettings() {
    setSubmitting(true);
    setPanelError("");
    try {
      await withUiTimeout(saveVatSettings(vatRegistered, vatPercentage));
    } catch (error) {
      setPanelError(friendlyFetchError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="User Access">
      <div className="grid min-w-0 gap-4">
        {!supabaseEnabled && (
          <StatusMessage tone="info" text="User accounts are temporarily unavailable. Please contact SiteGent support." />
        )}
        {supabaseEnabled && !authReady && (
          <div className="grid min-h-24 place-items-center rounded border border-dashed border-[#cfc6b5] bg-white text-sm font-bold text-[#69746f]">
            Checking account session...
          </div>
        )}
        {supabaseEnabled && authReady && !session && (
          <form onSubmit={submitAuth} className="grid min-w-0 gap-4">
            <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
              <p className="text-sm font-black text-[#166534]">
                {mode === "signup" ? "Create your SiteGent account" : "Sign in to your SiteGent workspace"}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#166534]">
                {mode === "signup"
                  ? "One account creates your private company workspace. Next you will add prices."
                  : "Use the email and password you created for your company workspace."}
              </p>
            </div>

            {mode === "signup" && (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold">
                  Your name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                    placeholder="Your full name"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Phone number
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="h-12 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                    placeholder="+27..."
                    autoComplete="tel"
                    inputMode="tel"
                    required
                  />
                </label>
              </div>
            )}

            <label className="grid gap-1 text-sm font-bold">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                type="password"
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : 1}
                required
              />
            </label>

            {mode === "signup" && (
              <>
                <div className="rounded border border-[#ded7ca] bg-[#fffdf8] p-3">
                  <p className="text-sm font-black">Password requirements</p>
                  <div className="mt-2 grid gap-1">
                    {passwordRules.map((rule) => (
                      <p
                        key={rule.label}
                        className={`flex items-center gap-2 text-sm font-bold ${rule.met ? "text-[#166534]" : "text-[#69746f]"}`}
                      >
                        {rule.met ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        {rule.label}
                      </p>
                    ))}
                  </div>
                </div>
                <label className="grid gap-1 text-sm font-bold">
                  Company name
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className="h-12 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                    placeholder="Your business name"
                    autoComplete="organization"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Business address <span className="font-medium text-[#69746f]">(optional)</span>
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className="h-12 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                    placeholder="Business address"
                    autoComplete="street-address"
                  />
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={submitting || (mode === "signin" ? !canSignIn : !canCreateAccount)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded bg-[#158052] px-4 text-sm font-black text-white hover:bg-[#116b44] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="animate-spin" size={17} />}
              {submitting
                ? mode === "signin" ? "Signing in..." : "Creating account..."
                : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div className="grid gap-2 rounded border border-[#ded7ca] bg-white p-3 text-sm leading-6">
              {mode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button type="button" onClick={() => setMode("signin")} className="font-black text-[#166534] underline">
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  New here?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="font-black text-[#166534] underline">
                    Create account
                  </button>
                </p>
              )}
              <p className="text-[#69746f]">
                Forgot password? Password reset is coming soon. For this pilot, message SiteGent support and we will help safely.
              </p>
            </div>
          </form>
        )}
        {supabaseEnabled && session && !profile && (
          <form onSubmit={submitOnboarding} className="grid min-w-0 gap-3">
            <OnboardingChecklist profile={profile} />
            <p className="text-sm leading-6 text-[#516158]">Finish company setup once, then your jobs stay private to your company.</p>
            <label className="grid gap-1 text-sm font-bold">
              Your name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                placeholder="Kgotso Powell"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Company name
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="h-11 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                placeholder="Powell Contractors"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="h-11 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                placeholder="+27..."
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Business address <span className="font-medium text-[#69746f]">(optional)</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="h-11 min-w-0 rounded border border-[#cfc6b5] bg-white px-3 outline-none focus:border-[#158052]"
                placeholder="Business address"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !name || !companyName}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-[#158052] px-4 text-sm font-black text-white hover:bg-[#116b44] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="animate-spin" size={17} />}
              {submitting ? "Saving..." : "Create company profile"}
            </button>
          </form>
        )}
        {supabaseEnabled && session && profile && (
          <>
            <div className="rounded border border-[#b9e1c7] bg-[#f2fbf5] p-3">
              <p className="font-black text-[#12623f]">Signed in as {profile.name}</p>
              <p className="mt-1 text-sm text-[#516158]">{profile.email}</p>
              <p className="mt-1 text-sm font-bold text-[#516158]">{profile.companyName}</p>
              <button
                onClick={() => void signOut()}
                className="mt-3 inline-flex h-10 items-center justify-center rounded border border-[#cfc6b5] bg-white px-4 text-sm font-black text-[#101814] hover:bg-[#f8fbf5]"
              >
                Sign out
              </button>
            </div>
            <OnboardingChecklist profile={profile} />
            <div className="grid gap-3 rounded border border-[#ded7ca] bg-[#fffdf8] p-3">
              <div>
                <p className="text-sm font-black">VAT settings</p>
                <p className="mt-1 text-sm leading-6 text-[#516158]">
                  Only enable VAT if this company is VAT registered.
                </p>
              </div>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded border border-[#cfc6b5] bg-white px-3 text-sm font-bold">
                VAT registered
                <input
                  type="checkbox"
                  checked={vatRegistered}
                  onChange={(event) => setVatRegistered(event.target.checked)}
                  className="size-5 accent-[#158052]"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                VAT percentage
                <div className="relative">
                  <input
                    value={String(vatPercentage)}
                    onChange={(event) => setVatPercentage(Number(event.target.value))}
                    disabled={!vatRegistered}
                    min="0"
                    max="100"
                    step="0.01"
                    type="number"
                    className="h-11 w-full min-w-0 rounded border border-[#cfc6b5] bg-white px-3 pr-10 outline-none focus:border-[#158052] disabled:bg-[#f3f4f6]"
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-black text-[#69746f]">%</span>
                </div>
              </label>
              <button
                onClick={() => void submitVatSettings()}
                disabled={submitting || !Number.isFinite(vatPercentage) || vatPercentage < 0 || vatPercentage > 100}
                className="inline-flex h-11 w-full items-center justify-center rounded bg-[#158052] px-4 text-sm font-black text-white hover:bg-[#116b44] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Saving..." : "Save VAT settings"}
              </button>
              <p className="text-xs font-bold leading-5 text-[#69746f]">
                {vatRegistered
                  ? `New quotes and invoices will charge ${vatPercentage}% VAT.`
                  : "New quotes and invoices will show that VAT is not charged."}
              </p>
            </div>
          </>
        )}
        <div className="rounded border border-[#d8d0c0] bg-[#f9f6ef] p-3">
          <p className="text-sm font-black">Browser acting strange?</p>
          <p className="mt-1 text-sm leading-6 text-[#516158]">
            Reset this browser session if sign-in or company setup keeps showing network errors.
          </p>
          <button
            onClick={() => void resetBrowserSession()}
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded border border-[#cfc6b5] bg-white px-4 text-sm font-black text-[#101814] hover:bg-[#f8fbf5]"
          >
            Reset this browser session
          </button>
        </div>
        {message && <StatusMessage tone="success" text={message} />}
        {(error || panelError) && <StatusMessage tone="error" text={error || panelError} />}
      </div>
    </Panel>
  );
}

function OnboardingChecklist({ profile }: { profile: UserProfile | null }) {
  const steps = [
    { label: "Step 1: Add company details", done: Boolean(profile) },
    { label: "Step 2: Add your prices", done: false },
    { label: "Step 3: Paste your first WhatsApp job request", done: false },
  ];

  return (
    <div className="rounded-lg border border-[#d1fae5] bg-[#f0fdf4] p-3">
      <p className="text-sm font-black text-[#166534]">Your setup path</p>
      <div className="mt-2 grid gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#166534]">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                step.done ? "bg-[#166534] text-white" : "border border-[#86efac] bg-white text-[#166534]"
              }`}
            >
              {step.done ? <CheckCircle2 size={14} /> : index + 1}
            </span>
            <span className="min-w-0">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className="mt-2 truncate text-2xl font-black tracking-tight text-[#111827]">{value}</p>
    </div>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-xl border border-[#e5e7eb] bg-white p-5 text-center">
      <div className="grid gap-3">
        <Loader2 className="mx-auto animate-spin text-[#166534]" size={22} />
        <p className="text-sm font-bold text-[#6b7280]">{text}</p>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm sm:p-5">
      <h2 className="mb-4 text-base font-black tracking-tight text-[#111827] sm:text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  const text = String(children).toLowerCase();
  const tone = text.includes("paid") || text.includes("ready") || text.includes("price") || text.includes("quoted")
    ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
    : text.includes("draft") || text.includes("review") || text.includes("medium")
      ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
      : text.includes("high") || text.includes("overdue") || text.includes("failed")
        ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
        : "border-[#e5e7eb] bg-[#f9fafb] text-[#374151]";

  return <span className={`inline-flex max-w-full shrink-0 rounded-full border px-2.5 py-1 text-xs font-black capitalize ${tone}`}>{children}</span>;
}

function StatusMessage({ tone, text }: { tone: "success" | "error" | "info"; text: string }) {
  const styles = {
    success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    error: "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]",
    info: "border-[#e5e7eb] bg-[#f9fafb] text-[#4b5563]",
  };
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <div className={`mt-3 flex min-w-0 items-start gap-2 rounded-lg border p-3 text-sm font-bold ${styles[tone]}`}>
      <Icon className="mt-0.5 shrink-0" size={16} />
      <span className="min-w-0">{text}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className="mt-1 min-w-0 break-words font-bold text-[#111827]">{value}</p>
    </div>
  );
}

function ArtifactCard({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-sm sm:p-4">
      <p className="mb-2 flex min-w-0 items-center gap-2 text-sm font-black">
        <Icon className="shrink-0" size={16} />
        <span className="min-w-0">{title}</span>
      </p>
      <p className="text-sm leading-6 text-[#6b7280]">{text}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-60 min-w-0 place-items-center rounded-xl border border-dashed border-[#d1d5db] bg-[#f9fafb] p-5 text-center sm:min-h-80 sm:p-8">
      <div className="max-w-sm">
        <div className="mx-auto grid size-10 place-items-center rounded-full bg-white text-[#6b7280] shadow-sm">
          <MessageCircle size={18} />
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-[#6b7280] sm:text-base">{text}</p>
      </div>
    </div>
  );
}
