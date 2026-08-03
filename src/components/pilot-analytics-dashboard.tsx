"use client";

import { Activity, AlertTriangle, ArrowDownRight, RefreshCw, Users } from "lucide-react";
import type { AnalyticsEvent, AnalyticsFunnelStep, AnalyticsSummary, FailureEvent, FailureSummary } from "@/lib/pilot-analytics";

type PilotAnalyticsDashboardProps = {
  signedIn: boolean;
  funnel: AnalyticsFunnelStep[];
  summary: AnalyticsSummary | null;
  recent: AnalyticsEvent[];
  failures: FailureSummary | null;
  recentFailures: FailureEvent[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
};

const eventLabels: Record<string, string> = {
  sign_up: "Signed up",
  company_created: "Created a company",
  pricing_configured: "Configured pricing",
  quote_generated: "Generated a quote",
  job_saved: "Saved a job",
  quote_exported: "Exported a quote",
  invoice_exported: "Exported an invoice",
  feedback_submitted: "Submitted feedback",
  pilot_feedback: "Submitted feedback",
  payment_request_copied: "Copied a payment request",
  payment_recorded: "Recorded a payment",
};

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <p className="text-xs font-bold uppercase text-[#6b7280]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#111827]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#6b7280]">{detail}</p>
    </div>
  );
}

export function PilotAnalyticsDashboard({
  signedIn,
  funnel,
  summary,
  recent,
  failures,
  recentFailures,
  loading,
  error,
  reload,
}: PilotAnalyticsDashboardProps) {
  const maxCount = Math.max(summary?.totalUsers ?? 0, 1);

  return (
    <section className="rounded-lg border border-[#d9dee5] bg-[#f9fafb] p-4 sm:p-5" aria-labelledby="pilot-analytics-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-[#166534]">
            {summary?.mode === "pilot" ? "Pilot overview" : "Workspace overview"}
          </p>
          <h2 id="pilot-analytics-title" className="mt-1 text-lg font-black text-[#111827]">
            Tester activation
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#516158]">
            The shortest path from account creation to a useful exported document.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={!signedIn || loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#c7ced8] bg-white px-4 text-sm font-black text-[#111827] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!signedIn && (
        <div className="mt-4 rounded border border-[#bfdbfe] bg-[#eff6ff] p-3 text-sm font-bold text-[#1d4ed8]">
          Sign in to see tester progress.
        </div>
      )}
      {error && <div className="mt-4 rounded border border-[#fecaca] bg-[#fef2f2] p-3 text-sm font-bold text-[#b91c1c]">{error}</div>}

      {summary && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total users" value={String(summary.totalUsers)} detail="Pilot accounts with a SiteGent profile" />
            <Metric
              label="Active users"
              value={String(summary.activeUsers)}
              detail={`Signed in or active during the last ${summary.activeWindowDays} days`}
            />
            <Metric
              label="Submitted feedback"
              value={String(summary.completedUsers)}
              detail="Users who reached the final measured pilot step"
            />
            <Metric
              label="Biggest drop-off"
              value={summary.biggestDropOff ?? "None yet"}
              detail="The step needing the clearest product fix"
            />
          </div>

          <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-[#166534]" />
              <h3 className="text-sm font-black text-[#111827]">Conversion funnel</h3>
            </div>
            <div className="mt-4 grid gap-4">
              {funnel.map((step, index) => (
                <div key={step.id} className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-black text-[#111827]">
                      {index + 1}. {step.label}
                    </span>
                    <span className="font-bold text-[#516158]">
                      {step.count}/{summary.totalUsers} users · {step.conversionRate}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-[#e5e7eb]" aria-hidden="true">
                    <div
                      className="h-full rounded bg-[#15803d]"
                      style={{ width: `${Math.max((step.count / maxCount) * 100, step.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  {index > 0 && step.dropOff > 0 && (
                    <p className="flex items-center gap-1 text-xs font-bold text-[#b45309]">
                      <ArrowDownRight size={14} />
                      {step.dropOff} dropped before this step ({step.dropOffRate}%)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {signedIn && !loading && summary && summary.totalUsers === 0 && (
        <div className="mt-4 rounded border border-dashed border-[#c7ced8] bg-white p-6 text-center text-sm font-bold text-[#6b7280]">
          No tester activity has been recorded yet.
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-white p-4">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-[#166534]" />
            <h3 className="text-sm font-black text-[#111827]">Recent activity</h3>
          </div>
          <div className="mt-2 divide-y divide-[#e5e7eb]">
            {recent.slice(0, 6).map((event, index) => (
              <div key={`${event.task_type}-${event.created_at}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-bold text-[#374151]">{eventLabels[event.task_type] ?? event.task_type}</span>
                <time className="shrink-0 text-xs text-[#6b7280]" dateTime={event.created_at}>
                  {new Intl.DateTimeFormat("en-ZA", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(event.created_at))}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}

      {failures && (
        <div className="mt-4 rounded-lg border border-[#fecaca] bg-white p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={17} className="text-[#b91c1c]" />
            <h3 className="text-sm font-black text-[#111827]">Pilot failures</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Last 24 hours" value={String(failures.last24Hours)} detail="Failures needing attention" />
            <Metric label="Save failures" value={String(failures.saveFailures)} detail="Jobs that did not save" />
            <Metric label="AI failures" value={String(failures.aiFailures)} detail="Fallbacks, limits, or errors" />
            <Metric label="Export failures" value={String(failures.exportFailures)} detail="Quote or invoice exports" />
            <Metric label="Auth failures" value={String(failures.authFailures)} detail="Blocked or failed sign-ins" />
            <Metric label="Frontend errors" value={String(failures.frontendErrors)} detail="Unhandled browser errors" />
            <Metric label="Other API errors" value={String(failures.apiErrors)} detail="Server-side API failures" />
            <Metric label="Total recorded" value={String(failures.total)} detail="Durable pilot failure records" />
          </div>
          {recentFailures.length > 0 && (
            <div className="mt-4 divide-y divide-[#fee2e2] rounded border border-[#fee2e2] bg-[#fef2f2] px-3">
              {recentFailures.slice(0, 6).map((failure, index) => (
                <div key={`${failure.action}-${failure.created_at}-${index}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="font-black text-[#991b1b]">{failure.action.replaceAll("_", " ")}</p>
                    <p className="truncate text-xs font-bold text-[#6b7280]">
                      {failure.route}{failure.message ? ` · ${failure.message}` : ""}
                    </p>
                  </div>
                  <time className="text-xs text-[#6b7280]" dateTime={failure.created_at}>
                    {new Intl.DateTimeFormat("en-ZA", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(failure.created_at))}
                  </time>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
