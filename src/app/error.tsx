"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/client-error-reporter";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error.message, "app.error");
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-[#111827]">
      <section className="w-full max-w-md rounded-lg border border-[#fecaca] bg-white p-6 shadow-sm">
        <h1 className="text-xl font-black">SiteGent hit a problem</h1>
        <p className="mt-2 text-sm leading-6 text-[#6b7280]">
          The error was recorded for pilot support. Try the action again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-11 items-center justify-center rounded bg-[#166534] px-4 text-sm font-black text-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
