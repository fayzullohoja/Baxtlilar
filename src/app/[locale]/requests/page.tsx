import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Screen, ScreenBody } from "@/components/ui/screen";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";
import {
  acceptMatchRequest,
  declineMatchRequest,
  withdrawMatchRequest,
} from "@/lib/matching/actions";

const TODAY_MS = 1000 * 60 * 60 * 24 * 365.25;
function ageFrom(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / TODAY_MS);
}

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ tab?: string; info?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = (await searchParams) ?? {};
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (user.lifecycle_state !== "active" && user.lifecycle_state !== "paused") {
    redirect(`/${locale}/main`);
  }

  const tab = sp.tab === "outgoing" ? "outgoing" : "incoming";

  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    supabaseAdmin
      .from("match_requests")
      .select("id, sender_id, status, intro_message, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("match_requests")
      .select("id, receiver_id, status, intro_message, created_at, decline_reason")
      .eq("sender_id", user.id)
      .in("status", ["pending", "declined", "accepted", "withdrawn"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // gather profile + photo for each counterparty
  const counterpartyIds = new Set<string>();
  for (const r of incoming ?? []) counterpartyIds.add(r.sender_id);
  for (const r of outgoing ?? []) counterpartyIds.add(r.receiver_id);
  const ids = Array.from(counterpartyIds);

  const [{ data: profiles }, { data: photos }] = await Promise.all([
    ids.length > 0
      ? supabaseAdmin
          .from("user_profiles")
          .select("user_id, display_name, birth_date, city")
          .in("user_id", ids)
      : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null; birth_date: string | null; city: string | null }> }),
    ids.length > 0
      ? supabaseAdmin
          .from("profile_photos")
          .select("user_id, storage_path")
          .in("user_id", ids)
          .eq("is_main", true)
      : Promise.resolve({ data: [] as Array<{ user_id: string; storage_path: string }> }),
  ]);

  const profileMap = new Map<
    string,
    { name: string | null; age: number | null; city: string | null; photoUrl: string | null }
  >();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, {
      name: p.display_name,
      age: ageFrom(p.birth_date),
      city: p.city,
      photoUrl: null,
    });
  }
  for (const p of photos ?? []) {
    const url = await getSignedPhotoUrl(p.storage_path);
    const entry = profileMap.get(p.user_id);
    if (entry) entry.photoUrl = url;
  }

  const incomingCount = incoming?.length ?? 0;

  return (
    <Screen>
      <ScreenBody className="pb-24">
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[--color-plum]">
          Заявки
        </h1>

        {sp.info || sp.error ? (
          <div
            className="mt-3 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: sp.error ? "var(--color-warn)" : "var(--color-success)",
              backgroundColor: sp.error ? "var(--color-warn-bg)" : "var(--color-success-bg)",
              color: sp.error ? "var(--color-warn)" : "var(--color-success)",
            }}
          >
            {flashMessage(sp.error, sp.info)}
          </div>
        ) : null}

        <div
          className="mt-4 inline-flex rounded-full p-1 text-sm"
          style={{ backgroundColor: "var(--color-blush)" }}
        >
          <Link
            href={`/${locale}/requests`}
            className={`rounded-full px-4 py-1.5 transition ${
              tab === "incoming"
                ? "bg-white font-semibold text-[--color-brand-deep] shadow"
                : "text-[--color-plum-mute]"
            }`}
          >
            Входящие
            {incomingCount > 0 ? (
              <span className="ml-1 text-xs">({incomingCount})</span>
            ) : null}
          </Link>
          <Link
            href={`/${locale}/requests?tab=outgoing`}
            className={`rounded-full px-4 py-1.5 transition ${
              tab === "outgoing"
                ? "bg-white font-semibold text-[--color-brand-deep] shadow"
                : "text-[--color-plum-mute]"
            }`}
          >
            Отправленные
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {tab === "incoming" ? (
            (incoming ?? []).length === 0 ? (
              <EmptyState text="Пока нет входящих заявок" />
            ) : (
              (incoming ?? []).map((r) => {
                const p = profileMap.get(r.sender_id);
                return (
                  <Card
                    key={r.id}
                    photoUrl={p?.photoUrl ?? null}
                    name={p?.name ?? null}
                    age={p?.age ?? null}
                    city={p?.city ?? null}
                    intro={r.intro_message}
                    profileHref={`/${locale}/profile/${r.sender_id}`}
                  >
                    <div className="mt-3 flex gap-2">
                      <form action={acceptMatchRequest} className="flex-1">
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button
                          type="submit"
                          className="block w-full rounded-full px-4 py-2 text-sm font-semibold text-white"
                          style={{ backgroundColor: "var(--color-brand-deep)" }}
                        >
                          Принять
                        </button>
                      </form>
                      <form action={declineMatchRequest} className="flex-1">
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button
                          type="submit"
                          className="block w-full rounded-full px-4 py-2 text-sm font-semibold"
                          style={{
                            backgroundColor: "var(--color-blush)",
                            color: "var(--color-brand-deep)",
                          }}
                        >
                          Отклонить
                        </button>
                      </form>
                    </div>
                  </Card>
                );
              })
            )
          ) : (outgoing ?? []).length === 0 ? (
            <EmptyState text="Вы пока не отправляли заявок" />
          ) : (
            (outgoing ?? []).map((r) => {
              const p = profileMap.get(r.receiver_id);
              return (
                <Card
                  key={r.id}
                  photoUrl={p?.photoUrl ?? null}
                  name={p?.name ?? null}
                  age={p?.age ?? null}
                  city={p?.city ?? null}
                  intro={r.intro_message}
                  profileHref={`/${locale}/profile/${r.receiver_id}`}
                >
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-[--color-ink-muted]">
                      {statusLabel(r.status)}
                    </span>
                    {r.status === "pending" ? (
                      <form action={withdrawMatchRequest}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: "var(--color-blush)",
                            color: "var(--color-brand-deep)",
                          }}
                        >
                          Отозвать
                        </button>
                      </form>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScreenBody>
      <BottomNav locale={locale} active="requests" badges={{ requests: incomingCount }} />
    </Screen>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "Ожидает ответа";
    case "accepted":
      return "Принят";
    case "declined":
      return "Отклонён";
    case "withdrawn":
      return "Отозван";
    case "expired":
      return "Истёк";
    default:
      return s;
  }
}

function flashMessage(error?: string, info?: string): string {
  if (error) return "Не удалось выполнить действие.";
  switch (info) {
    case "sent":
      return "Запрос отправлен.";
    case "declined":
      return "Запрос отклонён.";
    case "withdrawn":
      return "Запрос отозван.";
    case "they_sent_first":
      return "Этот человек уже отправил вам заявку — посмотрите ниже.";
    default:
      return "";
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl bg-white p-8 text-center text-sm text-[--color-ink-2] shadow-[0_2px_8px_rgba(74,44,53,0.04)]">
      {text}
    </div>
  );
}

function Card({
  photoUrl,
  name,
  age,
  city,
  intro,
  profileHref,
  children,
}: {
  photoUrl: string | null;
  name: string | null;
  age: number | null;
  city: string | null;
  intro: string | null;
  profileHref: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-[0_2px_8px_rgba(74,44,53,0.04)]">
      <Link href={profileHref} className="flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name ?? ""}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
            style={{
              backgroundColor: "var(--color-blush)",
              color: "var(--color-brand-deep)",
            }}
          >
            {(name ?? "—").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[--color-plum]">
            {name ?? "—"}
            {age != null ? <span className="ml-1 font-normal opacity-90">{age}</span> : null}
          </p>
          {city ? <p className="truncate text-xs text-[--color-ink-2]">{city}</p> : null}
        </div>
      </Link>
      {intro ? (
        <p className="mt-3 rounded-2xl bg-[--color-blush] px-3 py-2 text-sm text-[--color-ink-1]">
          {intro}
        </p>
      ) : null}
      {children}
    </div>
  );
}
