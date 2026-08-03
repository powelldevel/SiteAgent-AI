"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/client-error-reporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error.message, "app.global-error");
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
          <section style={{ maxWidth: 440, border: "1px solid #fecaca", borderRadius: 8, padding: 24 }}>
            <h1>SiteGent could not load</h1>
            <p>The error was recorded. Try loading the workspace again.</p>
            <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 16px" }}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
