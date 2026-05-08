import Link from "next/link";

export default function NotFound() {
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
            fontSize: "20px",
            fontWeight: 700,
          }}
          aria-hidden
        >
          404
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            margin: "0 0 8px",
            color: "var(--color-plum, #4a2c35)",
          }}
        >
          Страница не найдена
        </h1>
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.5,
            color: "var(--color-ink-2, #6b5f63)",
            margin: "0 0 24px",
          }}
        >
          Возможно, ссылка устарела. Вернитесь на главную.
        </p>
        <Link
          href="/ru/onboarding/welcome"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "44px",
            width: "100%",
            borderRadius: "16px",
            fontSize: "15px",
            fontWeight: 600,
            color: "white",
            backgroundColor: "var(--color-brand, #ff6f91)",
            textDecoration: "none",
          }}
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
