import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Screen, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";
import { sendMatchRequest } from "@/lib/matching/actions";
import {
  EDUCATION_LEVELS,
  WORK_INDUSTRIES,
  HAS_CHILDREN,
  WANTS_CHILDREN,
  MARRIAGE_TIMELINE,
  RELIGIOSITY,
  SMOKING,
  ALCOHOL,
  INTERESTS,
} from "@/lib/profile/options";

const TODAY_MS = 1000 * 60 * 60 * 24 * 365.25;
function ageFrom(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / TODAY_MS);
}

function lookupLabel<T extends { id: string; ru: string; uz: string }>(
  list: T[],
  id: string | null | undefined,
  locale: string,
): string | null {
  if (!id) return null;
  const o = list.find((x) => x.id === id);
  if (!o) return null;
  return locale === "uz" ? o.uz : o.ru;
}

export default async function ProfileViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ error?: string; info?: string }>;
}) {
  const { locale, id } = await params;
  const sp = (await searchParams) ?? {};
  setRequestLocale(locale);
  const viewer = await requireUser(locale);

  if (viewer.lifecycle_state !== "active") {
    redirect(`/${locale}/main`);
  }
  if (id === viewer.id) {
    redirect(`/${locale}/settings`);
  }

  const [{ data: target }, { data: profile }, { data: photos }, { data: openReq }] =
    await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, lifecycle_state, verification_status")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_profiles")
        .select(
          "display_name, birth_date, gender, city, district, education_level, work_industry, profession, has_children, wants_children, marriage_timeline, religiosity_level, smoking_status, alcohol_status, interests, about_me, marriage_values_text, is_discoverable, profile_paused, profession_visibility",
        )
        .eq("user_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("profile_photos")
        .select("storage_path, is_main, position")
        .eq("user_id", id)
        .order("is_main", { ascending: false })
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("match_requests")
        .select("id, sender_id, status")
        .or(
          `and(sender_id.eq.${viewer.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${viewer.id})`,
        )
        .in("status", ["pending", "accepted"])
        .maybeSingle(),
    ]);

  if (!target || !profile) notFound();
  if (target.lifecycle_state !== "active" || target.verification_status !== "approved") {
    redirect(`/${locale}/main?error=target_inactive`);
  }
  if (!profile.is_discoverable || profile.profile_paused) {
    redirect(`/${locale}/main?error=target_inactive`);
  }

  const photoUrls: string[] = [];
  for (const p of photos ?? []) {
    const u = await getSignedPhotoUrl(p.storage_path);
    if (u) photoUrls.push(u);
  }

  const age = ageFrom(profile.birth_date);
  const showProfession = profile.profession_visibility !== "hidden";

  // mark this candidate as seen so feed dedups
  await supabaseAdmin
    .from("match_views")
    .upsert(
      [{ viewer_id: viewer.id, target_id: id }],
      { onConflict: "viewer_id,target_id" },
    );

  const interestLabels: string[] = (
    (profile.interests ?? []) as string[]
  )
    .map((iid: string) => lookupLabel(INTERESTS, iid, locale))
    .filter((x): x is string => Boolean(x));

  const cantSendReason = openReq
    ? openReq.sender_id === viewer.id
      ? openReq.status === "accepted"
        ? "matched"
        : "already_sent"
      : openReq.status === "accepted"
        ? "matched"
        : "they_sent_first"
    : null;

  return (
    <Screen>
      <ScreenBody className="pb-32">
        <div className="-mx-5">
          <PhotoGallery urls={photoUrls} fallbackName={profile.display_name ?? "—"} />
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[--color-plum]">
            {profile.display_name ?? "—"}
            {age != null ? <span className="ml-2 font-normal opacity-90">{age}</span> : null}
          </h1>
          {profile.city ? (
            <p className="mt-1 text-sm text-[--color-ink-2]">
              {profile.city}
              {profile.district ? `, ${profile.district}` : ""}
            </p>
          ) : null}
        </div>

        {sp.error || sp.info ? (
          <div
            className="mt-3 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: sp.error ? "var(--color-warn)" : "var(--color-success)",
              backgroundColor: sp.error ? "var(--color-warn-bg)" : "var(--color-success-bg)",
              color: sp.error ? "var(--color-warn)" : "var(--color-success)",
            }}
          >
            {sp.error === "intro_short"
              ? "Сообщение слишком короткое."
              : sp.info === "already_sent"
                ? "Запрос уже отправлен."
                : "Что-то пошло не так."}
          </div>
        ) : null}

        {profile.about_me ? (
          <Section title="О себе">
            <p className="whitespace-pre-wrap leading-relaxed">{profile.about_me}</p>
          </Section>
        ) : null}

        <Section title="Семья и дети">
          <Row label="Семейное положение" value={lookupLabel(HAS_CHILDREN, profile.has_children, locale)} />
          <Row label="Хочу детей" value={lookupLabel(WANTS_CHILDREN, profile.wants_children, locale)} />
          <Row label="Готовность к браку" value={lookupLabel(MARRIAGE_TIMELINE, profile.marriage_timeline, locale)} />
        </Section>

        <Section title="Работа и образование">
          <Row label="Образование" value={lookupLabel(EDUCATION_LEVELS, profile.education_level, locale)} />
          <Row label="Сфера" value={lookupLabel(WORK_INDUSTRIES, profile.work_industry, locale)} />
          {showProfession && profile.profession ? (
            <Row label="Профессия" value={profile.profession} />
          ) : null}
        </Section>

        <Section title="Ценности">
          <Row label="Религиозность" value={lookupLabel(RELIGIOSITY, profile.religiosity_level, locale)} />
          <Row label="Курение" value={lookupLabel(SMOKING, profile.smoking_status, locale)} />
          <Row label="Алкоголь" value={lookupLabel(ALCOHOL, profile.alcohol_status, locale)} />
        </Section>

        {interestLabels.length > 0 ? (
          <Section title="Интересы">
            <div className="flex flex-wrap gap-2">
              {interestLabels.map((label: string, i: number) => (
                <span
                  key={i}
                  className="rounded-full px-3 py-1 text-sm"
                  style={{
                    backgroundColor: "var(--color-blush)",
                    color: "var(--color-brand-deep)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </Section>
        ) : null}

        {profile.marriage_values_text ? (
          <Section title="Что важно в браке">
            <p className="whitespace-pre-wrap leading-relaxed">{profile.marriage_values_text}</p>
          </Section>
        ) : null}

        <div className="mt-8">
          <Link
            href={`/${locale}/main`}
            className="text-sm font-medium text-[--color-plum-mute] underline-offset-2 hover:underline"
          >
            ← Назад к ленте
          </Link>
        </div>

        {/* Sticky action bar */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-white/95 px-5 py-3 backdrop-blur"
          style={{ borderColor: "var(--color-line)" }}
        >
          {cantSendReason === "matched" ? (
            <Link
              href={`/${locale}/chats`}
              className="block w-full rounded-full px-5 py-3 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-brand-deep)" }}
            >
              Открыть чат
            </Link>
          ) : cantSendReason === "already_sent" ? (
            <button
              disabled
              className="block w-full rounded-full px-5 py-3 text-center text-sm font-semibold opacity-60"
              style={{
                backgroundColor: "var(--color-line)",
                color: "var(--color-plum-mute)",
              }}
            >
              Запрос уже отправлен
            </button>
          ) : cantSendReason === "they_sent_first" ? (
            <Link
              href={`/${locale}/requests`}
              className="block w-full rounded-full px-5 py-3 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-brand-deep)" }}
            >
              Этот человек уже написал вам — открыть заявки
            </Link>
          ) : (
            <SendRequestForm
              targetId={id}
              locale={locale}
              targetName={profile.display_name ?? "—"}
            />
          )}
        </div>
      </ScreenBody>
    </Screen>
  );
}

function PhotoGallery({ urls, fallbackName }: { urls: string[]; fallbackName: string }) {
  if (urls.length === 0) {
    return (
      <div
        className="flex aspect-[4/5] w-full items-center justify-center text-7xl font-light"
        style={{
          backgroundColor: "var(--color-blush)",
          color: "var(--color-brand-deep)",
        }}
      >
        {fallbackName.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="flex snap-x snap-mandatory overflow-x-auto">
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={u}
          alt={`photo ${i + 1}`}
          className="aspect-[4/5] w-full shrink-0 snap-center object-cover"
        />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
        {title}
      </h2>
      <div className="rounded-2xl bg-white p-4 text-sm text-[--color-ink-1] shadow-[0_2px_8px_rgba(74,44,53,0.04)]">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs uppercase tracking-wide text-[--color-ink-muted]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function SendRequestForm({
  targetId,
  locale,
  targetName,
}: {
  targetId: string;
  locale: string;
  targetName: string;
}) {
  return (
    <form action={sendMatchRequest} className="flex flex-col gap-2">
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="locale" value={locale} />
      <textarea
        name="intro"
        rows={2}
        maxLength={400}
        placeholder={`Короткое сообщение для ${targetName} (необязательно)`}
        className="w-full resize-none rounded-2xl border bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2"
        style={{
          borderColor: "var(--color-line)",
        }}
      />
      <button
        type="submit"
        className="rounded-full px-5 py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
        style={{ backgroundColor: "var(--color-brand-deep)" }}
      >
        Хочу познакомиться
      </button>
    </form>
  );
}
