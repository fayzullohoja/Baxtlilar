import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Screen, ScreenBody } from "@/components/ui/screen";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";
import { recommendFor } from "@/lib/matching/recommend";

const DAILY_LIMIT = 2;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function MainPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; info?: string }>;
}) {
  const { locale } = await params;
  const sp = (await searchParams) ?? {};
  setRequestLocale(locale);
  const t = await getTranslations("main");
  const user = await requireUser(locale);

  if (user.lifecycle_state === "blocked") redirect(`/${locale}/blocked`);
  if (user.lifecycle_state === "deleted") redirect(`/${locale}/blocked`);
  if (user.lifecycle_state === "onboarding") {
    redirect(`/${locale}/onboarding/welcome`);
  }

  const isPaused = user.lifecycle_state === "paused";

  // Fetch in parallel: header data, quota, recommendations, signed url, badges
  const [
    { data: u },
    { data: profile },
    { data: mainPhoto },
    quotaResp,
    recs,
    pendingResp,
    chatsResp,
  ] = await Promise.all([
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
    supabaseAdmin
      .from("daily_request_quotas")
      .select("sent_count")
      .eq("user_id", user.id)
      .eq("quota_date", todayUTC())
      .maybeSingle(),
    isPaused ? Promise.resolve([]) : recommendFor(user.id, 10),
    supabaseAdmin
      .from("match_requests")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("status", "pending"),
    supabaseAdmin
      .from("chats")
      .select("id")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
  ]);

  const pendingCount = pendingResp.count ?? 0;
  let unreadChats = 0;
  const chatIds = (chatsResp.data ?? []).map((c) => c.id);
  if (chatIds.length > 0) {
    const { data: unreadRows } = await supabaseAdmin
      .from("chat_messages")
      .select("chat_id")
      .in("chat_id", chatIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    unreadChats = new Set((unreadRows ?? []).map((r) => r.chat_id)).size;
  }

  const sentToday = quotaResp?.data?.sent_count ?? 0;
  const remaining = Math.max(0, DAILY_LIMIT - sentToday);
  const photoUrl = mainPhoto ? await getSignedPhotoUrl(mainPhoto.storage_path) : null;
  const name = profile?.display_name ?? u?.telegram_first_name ?? "—";

  // signed urls for recommendation photos
  const recsWithUrls = await Promise.all(
    recs.map(async (r) => ({
      ...r,
      photo_url: r.main_photo_path
        ? await getSignedPhotoUrl(r.main_photo_path)
        : null,
    })),
  );

  return (
    <Screen>
      <ScreenBody>
        {sp.error || sp.info ? <FlashBanner error={sp.error} info={sp.info} /> : null}

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
                {profile?.city ?? "—"} · {t("limit", { count: remaining })}
              </p>
            </div>
            <Link
              href={`/${locale}/settings`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[--color-plum-mute] transition hover:bg-[--color-blush] hover:text-[--color-brand-deep]"
              aria-label="Настройки"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M5 5l1.8 1.8M13.2 13.2L15 15M5 15l1.8-1.8M13.2 6.8L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
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

        <section className="mt-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
            Рекомендации на сегодня
          </h2>

          {recsWithUrls.length === 0 ? (
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
                Пока нет подходящих кандидатов
              </h3>
              <p className="mt-2 text-sm text-[--color-ink-2]">
                Мы продолжаем искать. Загляните позже — список обновляется по мере регистрации новых верифицированных пользователей.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recsWithUrls.map((r) => (
                <Link
                  key={r.user_id}
                  href={`/${locale}/profile/${r.user_id}`}
                  className="block overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)] transition active:scale-[0.99]"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden">
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photo_url}
                        alt={r.display_name ?? ""}
                        className="block h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-5xl font-light"
                        style={{
                          backgroundColor: "var(--color-blush)",
                          color: "var(--color-brand-deep)",
                        }}
                      >
                        {(r.display_name ?? "—").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-lg font-semibold text-white">
                        {r.display_name ?? "—"}
                        {r.age != null ? <span className="ml-2 font-normal opacity-90">{r.age}</span> : null}
                      </p>
                      {r.city ? (
                        <p className="mt-0.5 text-xs text-white/80">{r.city}</p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <BottomNav
          locale={locale}
          active="main"
          badges={{ requests: pendingCount, chats: unreadChats }}
        />
      </ScreenBody>
    </Screen>
  );
}

function FlashBanner({ error, info }: { error?: string; info?: string }) {
  const text = error
    ? errorText(error)
    : info
      ? infoText(info)
      : null;
  if (!text) return null;
  const isErr = !!error;
  return (
    <div
      className="mt-2 rounded-2xl border px-4 py-3 text-sm"
      style={{
        borderColor: isErr ? "var(--color-warn)" : "var(--color-success)",
        backgroundColor: isErr ? "var(--color-warn-bg)" : "var(--color-success-bg)",
        color: isErr ? "var(--color-warn)" : "var(--color-success)",
      }}
    >
      {text}
    </div>
  );
}

function errorText(code: string): string {
  switch (code) {
    case "quota":
      return "На сегодня вы исчерпали лимит запросов. Возвращайтесь завтра.";
    case "not_active":
      return "Ваш аккаунт ещё не активирован.";
    case "target_inactive":
      return "Этот пользователь сейчас недоступен.";
    case "not_found":
      return "Пользователь не найден.";
    default:
      return "Что-то пошло не так.";
  }
}
function infoText(code: string): string {
  switch (code) {
    case "sent":
      return "Запрос отправлен.";
    case "declined":
      return "Запрос отклонён.";
    case "withdrawn":
      return "Запрос отозван.";
    default:
      return "";
  }
}

