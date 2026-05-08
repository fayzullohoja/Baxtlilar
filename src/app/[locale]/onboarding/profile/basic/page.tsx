import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { basicProfileSchema } from "@/lib/profile/schemas";

export default async function ProfileBasicPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const user = await requireUserAtStep(locale, "profile_basic");

  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select("display_name, birth_date, gender, city, district, marital_status, currently_married")
    .eq("user_id", user.id)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const parsed = basicProfileSchema.safeParse({
      display_name: formData.get("display_name"),
      birth_date: formData.get("birth_date"),
      gender: formData.get("gender"),
      city: formData.get("city"),
      district: formData.get("district") ?? "",
      marital_status: formData.get("marital_status"),
      currently_married: formData.get("currently_married"),
    });
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message === "min_age" ? "min_age" : "invalid";
      redirect(`/${locale}${ONBOARDING_PATHS.profile_basic}?error=${code}`);
    }
    const v = parsed.data;
    if (v.currently_married === "yes") {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_basic}?error=married`);
    }
    await supabaseAdmin.from("user_profiles").upsert(
      {
        user_id: user.id,
        display_name: v.display_name,
        birth_date: v.birth_date,
        gender: v.gender,
        city: v.city,
        district: v.district || null,
        marital_status: v.marital_status,
        currently_married: false,
      },
      { onConflict: "user_id" },
    );
    await transition(
      user.id,
      { onboarding_step: "profile_photos" },
      "profile basic saved",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.profile_photos}`);
  }

  const errMsg =
    error === "min_age"
      ? "Минимальный возраст — 18 лет"
      : error === "married"
        ? t("currently_married_warn")
        : error === "invalid"
          ? "Заполните все обязательные поля"
          : null;

  const inputCls =
    "h-12 rounded-2xl border border-[--color-line] bg-[--color-blush-soft] px-4 text-base text-[--color-plum] placeholder:text-[--color-ink-muted]";
  return (
    <Screen>
      <ScreenHeader title={t("basic_title")} />
      <ScreenBody>
        <form action={save} className="flex flex-col gap-4">
          {errMsg ? (
            <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
              {errMsg}
            </p>
          ) : null}
          <Field label={t("display_name")}>
            <input
              name="display_name"
              defaultValue={existing?.display_name ?? ""}
              required
              minLength={2}
              maxLength={50}
              className={inputCls}
            />
          </Field>
          <Field label={t("birth_date")}>
            <input
              name="birth_date"
              type="date"
              defaultValue={existing?.birth_date ?? ""}
              required
              className={inputCls}
            />
          </Field>
          <Field label={t("gender")}>
            <div className="flex gap-2">
              <RadioPill name="gender" value="male" defaultChecked={existing?.gender === "male"} label={t("gender_male")} />
              <RadioPill name="gender" value="female" defaultChecked={existing?.gender === "female"} label={t("gender_female")} />
            </div>
          </Field>
          <Field label={t("city")}>
            <input
              name="city"
              defaultValue={existing?.city ?? "Ташкент"}
              required
              className={inputCls}
            />
          </Field>
          <Field label={t("district")}>
            <input
              name="district"
              defaultValue={existing?.district ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={t("marital_status")}>
            <select
              name="marital_status"
              defaultValue={existing?.marital_status ?? ""}
              required
              className={`${inputCls} appearance-none`}
            >
              <option value="" disabled>—</option>
              <option value="never_married">{t("ms_never")}</option>
              <option value="divorced">{t("ms_divorced")}</option>
              <option value="widowed">{t("ms_widowed")}</option>
            </select>
          </Field>
          <Field label={t("currently_married")}>
            <div className="flex gap-2">
              <RadioPill name="currently_married" value="no" defaultChecked label={tc("no")} />
              <RadioPill name="currently_married" value="yes" label={tc("yes")} />
            </div>
          </Field>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // <div> not <label> — RadioPill children render their own <label>, and
  // nested labels break radio clicking (only first option becomes selectable).
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
        {label}
      </p>
      {children}
    </div>
  );
}

function RadioPill({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex flex-1 cursor-pointer items-center justify-center rounded-2xl border border-[--color-line] bg-white px-4 py-3.5 text-[15px] text-[--color-plum] transition has-[:checked]:border-[--color-brand] has-[:checked]:bg-[--color-blush] has-[:checked]:text-[--color-brand-deep] has-[:checked]:font-semibold">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
        required
      />
      {label}
    </label>
  );
}
