import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Screen,
  ScreenHeader,
  ScreenBody,
  ScreenFooter,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default async function ProfilePreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const user = await requireUserAtStep(locale, "profile_preview");

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: mainPhoto } = await supabaseAdmin
    .from("profile_photos")
    .select("storage_path")
    .eq("user_id", user.id)
    .eq("is_main", true)
    .maybeSingle();

  const mainPhotoUrl = mainPhoto ? await getSignedPhotoUrl(mainPhoto.storage_path) : null;

  async function confirm() {
    "use server";
    // Defense-in-depth: don't let an empty profile through.
    const { data: p } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name, birth_date, gender, city, marital_status, about_me, marriage_values_text, looking_for_gender")
      .eq("user_id", user.id)
      .maybeSingle();
    const required: Array<keyof typeof p> = [
      "display_name",
      "birth_date",
      "gender",
      "city",
      "marital_status",
      "about_me",
      "marriage_values_text",
      "looking_for_gender",
    ] as never;
    if (!p || required.some((k) => !p?.[k])) {
      // Send back to basic — they'll re-walk through.
      await transition(
        user.id,
        { onboarding_step: "profile_basic" },
        "preview confirm rejected — incomplete profile",
      );
      redirect(`/${locale}${ONBOARDING_PATHS.profile_basic}?error=invalid`);
    }

    await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { user_id: user.id, profile_completed_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    await transition(
      user.id,
      { profile_completion: "completed", onboarding_step: "quiz_intro" },
      "profile confirmed in preview",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.quiz_intro}`);
  }

  async function editFromStep(step: string) {
    "use server";
    await transition(
      user.id,
      { onboarding_step: step as never },
      `edit profile from preview → ${step}`,
    );
    redirect(`/${locale}/onboarding/profile/${step.replace("profile_", "").replace("_", "-")}`);
  }

  async function editBasic() {
    "use server";
    await editFromStep("profile_basic");
  }
  async function editPhotos() {
    "use server";
    await editFromStep("profile_photos");
  }
  async function editEducation() {
    "use server";
    await editFromStep("profile_education");
  }
  async function editFamily() {
    "use server";
    await editFromStep("profile_family");
  }
  async function editValues() {
    "use server";
    await editFromStep("profile_values");
  }
  async function editLookingFor() {
    "use server";
    await editFromStep("profile_looking_for");
  }
  async function editAbout() {
    "use server";
    await editFromStep("profile_about");
  }

  const age = ageFromDob(profile?.birth_date ?? null);

  // Compute completion across the major sections — encourages user to fill
  // gaps before they confirm.
  const sectionFilledCount = [
    !!profile?.display_name && !!profile?.gender,
    !!mainPhotoUrl,
    !!profile?.education_level && !!profile?.work_industry,
    !!profile?.has_children && !!profile?.wants_children && !!profile?.marriage_timeline,
    !!profile?.religiosity_level && Array.isArray(profile?.interests) && profile.interests.length > 0,
    !!profile?.looking_for_gender && Array.isArray(profile?.preferred_partner_qualities) && profile.preferred_partner_qualities.length >= 3,
    !!profile?.about_me && !!profile?.marriage_values_text,
  ].filter(Boolean).length;
  const totalSections = 7;
  const completionPct = Math.round((sectionFilledCount / totalSections) * 100);

  return (
    <Screen>
      <ScreenHeader
        title={t("preview_title")}
        subtitle="Посмотрите как выглядит анкета. Если хотите что-то поменять — нажмите «изменить» рядом с разделом."
      />
      <ScreenBody>
        {/* Completion bar */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
              Заполнено разделов
            </span>
            <span className="text-xs text-[--color-plum-soft]">
              {sectionFilledCount} из {totalSections} · {completionPct}%
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--color-line)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${completionPct}%`,
                backgroundColor:
                  completionPct === 100
                    ? "var(--color-success)"
                    : "var(--color-brand)",
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {/* Header card with main photo */}
          <div className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
            {mainPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainPhotoUrl}
                alt="main photo"
                className="block h-64 w-full object-cover"
              />
            ) : null}
            <div className="px-5 py-4">
              <p className="text-xl font-semibold tracking-tight text-[--color-plum]">
                {profile?.display_name ?? "—"}
                {age != null ? (
                  <span className="ml-2 font-normal text-[--color-plum-mute]">
                    · {age}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-[--color-ink-2]">
                {profile?.city ?? "—"}
                {profile?.district ? `, ${profile.district}` : ""}
              </p>
            </div>
          </div>

          <Section
            title="Основное"
            editAction={editBasic}
            rows={[
              ["Имя", profile?.display_name],
              ["Возраст", age != null ? String(age) : null],
              ["Пол", profile?.gender === "female" ? "Жен" : profile?.gender === "male" ? "Муж" : null],
              ["Город", profile?.city],
              ["Семейный статус", profile?.marital_status],
            ]}
          />

          <Section
            title="Фото"
            editAction={editPhotos}
            rows={[["Главное фото", mainPhotoUrl ? "загружено" : "—"]]}
          />

          <Section
            title="Образование и работа"
            editAction={editEducation}
            rows={[
              ["Образование", profile?.education_level],
              ["Сфера", profile?.work_industry],
              ["Профессия", profile?.profession],
              ["Занятость", profile?.employment_status],
              ["Финансы", profile?.financial_stability],
            ]}
          />

          <Section
            title="Семья"
            editAction={editFamily}
            rows={[
              ["Дети", profile?.has_children],
              ["Хочет детей", profile?.wants_children],
              ["Готовность к браку", profile?.marriage_timeline],
              ["Готов переехать", profile?.relocation_readiness],
            ]}
          />

          <Section
            title="Ценности"
            editAction={editValues}
            rows={[
              ["Религиозность", profile?.religiosity_level],
              ["Курение", profile?.smoking_status],
              ["Алкоголь", profile?.alcohol_status],
              [
                "Интересы",
                Array.isArray(profile?.interests)
                  ? profile.interests.join(", ")
                  : null,
              ],
            ]}
          />

          <Section
            title="Кого ищу"
            editAction={editLookingFor}
            rows={[
              [
                "Пол",
                profile?.looking_for_gender === "female"
                  ? "Жен"
                  : profile?.looking_for_gender === "male"
                    ? "Муж"
                    : null,
              ],
              [
                "Возраст",
                profile?.preferred_age_min && profile?.preferred_age_max
                  ? `${profile.preferred_age_min}–${profile.preferred_age_max}`
                  : null,
              ],
              ["География", profile?.preferred_city_scope],
              ["Семейный статус", profile?.preferred_marital_status],
              ["Дети партнёра", profile?.preferred_children_status],
              [
                "Качества",
                Array.isArray(profile?.preferred_partner_qualities)
                  ? profile.preferred_partner_qualities.join(", ")
                  : null,
              ],
            ]}
          />

          <Section
            title="О себе"
            editAction={editAbout}
            rows={[
              ["Текст о себе", profile?.about_me],
              ["О ценностях семьи", profile?.marriage_values_text],
            ]}
          />
        </div>
      </ScreenBody>
      <ScreenFooter>
        {sectionFilledCount < totalSections ? (
          <p className="rounded-2xl bg-[--color-warn-bg] px-4 py-3 text-center text-xs text-[--color-warn]">
            Заполните оставшиеся {totalSections - sectionFilledCount} раздел(а), чтобы продолжить
          </p>
        ) : null}
        <form action={confirm}>
          <PrimaryButton
            type="submit"
            disabled={sectionFilledCount < totalSections}
          >
            {t("preview_confirm")}
          </PrimaryButton>
        </form>
        <form action={editBasic}>
          <SecondaryButton type="submit">{tc("back")}</SecondaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}

function Section({
  title,
  editAction,
  rows,
}: {
  title: string;
  editAction: () => Promise<void>;
  rows: Array<[string, string | null | undefined]>;
}) {
  const filled = rows.filter(([, v]) => v != null && v !== "");
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
      <div className="flex items-center justify-between border-b border-[--color-line-soft] px-5 py-3">
        <p className="text-sm font-semibold text-[--color-plum]">{title}</p>
        <form action={editAction}>
          <button
            type="submit"
            className="text-xs font-medium text-[--color-brand-deep] hover:underline"
          >
            изменить →
          </button>
        </form>
      </div>
      {filled.length === 0 ? (
        <p className="px-5 py-4 text-xs text-[--color-ink-muted]">
          раздел не заполнен
        </p>
      ) : (
        <dl className="divide-y divide-[--color-line-soft]">
          {filled.map(([k, v]) => (
            <div
              key={k}
              className="flex items-start justify-between gap-3 px-5 py-2.5"
            >
              <dt className="shrink-0 text-xs text-[--color-ink-muted]">{k}</dt>
              <dd className="text-right text-sm text-[--color-plum]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
