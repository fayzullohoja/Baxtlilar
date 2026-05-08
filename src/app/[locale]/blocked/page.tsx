import { setRequestLocale, getTranslations } from "next-intl/server";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/screen";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SUPPORT_USERNAME = "baxtlilar_support";

export default async function BlockedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blocked");

  // Pull blocked_reason if user has session — show it so they understand why
  const session = await getCurrentUser();
  const { data: u } = session
    ? await supabaseAdmin
        .from("users")
        .select("blocked_at, blocked_reason")
        .eq("id", session.id)
        .maybeSingle()
    : { data: null };

  const blockedAt = u?.blocked_at
    ? new Date(u.blocked_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const reason = u?.blocked_reason ?? null;

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-8 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-danger-bg)",
              color: "var(--color-danger)",
            }}
            aria-hidden
          >
            ✕
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-[340px] text-[15px] leading-relaxed text-[--color-ink-2]">
            {t("body")}
          </p>

          {reason || blockedAt ? (
            <div
              className="mt-7 w-full rounded-3xl border border-[--color-danger-bg] px-5 py-4 text-sm leading-relaxed"
              style={{ backgroundColor: "var(--color-danger-bg)" }}
            >
              {blockedAt ? (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[--color-danger]">
                  Дата блокировки: {blockedAt}
                </p>
              ) : null}
              {reason ? (
                <p className="text-[--color-danger]">{reason}</p>
              ) : null}
            </div>
          ) : null}

          <p className="mt-7 text-xs leading-relaxed text-[--color-ink-muted]">
            Если считаете, что это ошибка — напишите в поддержку. Мы пересмотрим решение.
          </p>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <a
          href={`https://t.me/${SUPPORT_USERNAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(255,111,145,0.55)]"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M16.5 4.5L13.5 17 8 12.5 6 14.5l1.5-4 6.5-6L7 12 3 10.5z" />
          </svg>
          Написать в поддержку
        </a>
        <span className="inline-flex h-11 w-full items-center justify-center text-sm text-[--color-plum-mute]">
          {t("rules")}
        </span>
      </ScreenFooter>
    </Screen>
  );
}
