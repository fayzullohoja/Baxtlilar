"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to logs — Vercel runtime captures console.error
    console.error("[global-error]", error.digest, error.message);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backgroundColor: "var(--color-cream, #fff9f8)",
        color: "var(--color-ink, #2e2e2e)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "360px", textAlign: "center" }}>
        <div
          style={{
            margin: "0 auto 16px",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--color-blush, #fff1f4)",
            color: "var(--color-brand-deep, #d94f73)",
            fontSize: "32px",
          }}
          aria-hidden
        >
          ⚠
        </div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 600,
            margin: "0 0 8px",
            color: "var(--color-plum, #4a2c35)",
          }}
        >
          Что-то пошло не так
        </h1>
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.5,
            color: "var(--color-ink-2, #6b5f63)",
            margin: "0 0 24px",
          }}
        >
          Произошла неожиданная ошибка. Попробуйте обновить страницу.
        </p>
        <button
          onClick={reset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "44px",
            width: "100%",
            borderRadius: "16px",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: 600,
            color: "white",
            backgroundColor: "var(--color-brand, #ff6f91)",
          }}
        >
          Попробовать снова
        </button>
        {error.digest ? (
          <p
            style={{
              marginTop: "16px",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "var(--color-ink-muted, #9b8c90)",
            }}
          >
            ref: {error.digest}
          </p>
        ) : null}
        {error.message ? (
          <details
            style={{
              marginTop: "12px",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "var(--color-ink-muted, #9b8c90)",
              textAlign: "left",
            }}
          >
            <summary style={{ cursor: "pointer" }}>Подробности</summary>
            <pre
              style={{
                marginTop: "8px",
                padding: "8px",
                backgroundColor: "rgba(0,0,0,0.04)",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {error.message}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
