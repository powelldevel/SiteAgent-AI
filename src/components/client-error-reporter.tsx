"use client";

import { useEffect } from "react";

const AUTH_STORAGE_KEY = "sitegent_session";

function accessToken() {
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    return (JSON.parse(stored) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}

export function reportClientError(message: string, source: string) {
  const token = accessToken();
  if (!token) return;

  void fetch("/api/observability", {
    method: "POST",
    keepalive: true,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "frontend_error",
      message: message.slice(0, 500),
      metadata: {
        source,
        path: window.location.pathname,
      },
    }),
  }).catch(() => {
    // Error reporting must never create another visible application error.
  });
}

export function ClientErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError(event.message || "Unhandled frontend error", "window.error");
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportClientError(reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection"), "unhandledrejection");
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
