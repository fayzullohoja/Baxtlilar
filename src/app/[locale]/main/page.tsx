import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";

export default async function MainPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("main");
  const user = await requireUser(locale);

  // Lifecycle gate — only active/paused users see /main.
  if (user.lifecycle_state === "blocked") redirect(`/${locale}/blocked`);
  if (user.lifecycle_state === "deleted") redirect(`/${locale}/blocked`);
  if (user.lifecycle_state === "onboarding") {
    redirect(`/${locale}/onboarding/welcome`);
  }

  const [{ data: u }, { data: profile }, { data: mainPhoto }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("telegram_first_name")
      .eq("id", user.id)
      .single(),
    supabaseAdmin
      .from("user_profiles")
      .select("display_name, city")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("profile_photos")
      .select("storage_path")
      .eq("user_id", user.id)
      .eq("is_main", true)
      .maybeSingle(),
  ]);

  const photoUrl = mainPhoto ? await getSignedPhotoUrl(mainPhoto.storage_path) : null;
  const name = profile?.display_name ?? u?.telegram_first_name ?? "—";
  const isPaused = user.lifecycle_state === "paused";

  return (
    <Screen>
      <ScreenBody>
        {/* Profile header card */}
        <header className="mt-2 overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="profile"
              className="block h-44 w-full object-cover"
            />
          ) : (
            <div
              className="flex h-44 items-center justify-center text-3xl font-semibold"
              style={{
                backgroundColor: "var(--color-blush)",
                color: "var(--color-brand-deep)",
              }}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-lg font-semibold tracking-tight text-[--color-plum]">
                {t("greeting", { name })}
              </p>
              <p className="mt-1 text-sm text-[--color-ink-2]">
                {profile?.city ?? "Ташкент"} · {t("limit", { count: 2 })}
              </p>
            </div>
            <a
              href={`/${locale}/settings`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[--color-plum-mute] transition hover:bg-[--color-blush] hover:text-[--color-brand-deep]"
              aria-label="Настройки"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M5 5l1.8 1.8M13.2 13.2L15 15M5 15l1.8-1.8M13.2 6.8L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </a>
          </div>
        </header>

        {isPaused ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "var(--color-warn)",
              backgroundColor: "var(--color-warn-bg)",
              color: "var(--color-warn)",
            }}
          >
            Ваш аккаунт на паузе. Возобновите в настройках, чтобы получать рекомендации.
          </div>
        ) : null}

        {/* Recommendation feed placeholder */}
        <section className="mt-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
            Рекомендации на сегодня
          </h2>
          <div className="rounded-3xl bg-white p-8 text-center shadow-[0_4px_16px_rgba(74,44,53,0.04)]">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{
                backgroundColor: "var(--color-blush)",
                color: "var(--color-brand-deep)",
              }}
              aria-hidden
            >
              🌸
            </div>
            <h3 className="text-base font-semibold text-[--color-plum]">
              Ищем подходящих кандидатов
            </h3>
            <p className="mt-2 text-sm text-[--color-ink-2]">{t("todo")}</p>
            <p className="mt-3 text-xs text-[--color-ink-muted]">
              Лента и заявки появятся в следующих обновлениях
            </p>
          </div>
        </section>
      </ScreenBody>
    </Screen>
  );
}
