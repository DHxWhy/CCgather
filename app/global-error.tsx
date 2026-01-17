"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log error to monitoring service (e.g., Sentry)
    console.error("Global Application Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --color-bg-primary: #0d0d0f;
                --color-text-primary: #f9f9f8;
                --color-text-secondary: #a1a1aa;
                --color-claude-coral: #da7756;
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-bg-primary)",
          padding: "1rem",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
          {/* Error Icon */}
          <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: "5rem",
                height: "5rem",
                borderRadius: "9999px",
                backgroundColor: "rgba(218, 119, 86, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                style={{ width: "2.5rem", height: "2.5rem", color: "var(--color-claude-coral)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
            A critical error occurred. Please try again or return to the home page.
          </p>

          {/* Error Details (Development) */}
          {process.env.NODE_ENV === "development" && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "1rem",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "0.5rem",
                textAlign: "left",
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  color: "var(--color-text-secondary)",
                  wordBreak: "break-all",
                  margin: 0,
                }}
              >
                {error.message}
              </p>
              {error.digest && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    color: "rgba(255, 255, 255, 0.4)",
                    marginTop: "0.5rem",
                    marginBottom: 0,
                  }}
                >
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1rem",
                backgroundColor: "var(--color-claude-coral)",
                color: "white",
                fontWeight: 500,
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <svg
                style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1rem",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "var(--color-text-primary)",
                fontWeight: 500,
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <svg
                style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
