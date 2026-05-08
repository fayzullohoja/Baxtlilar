import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Screen,
  ScreenHeader,
  ScreenBody,
  PrimaryButton,
  Field,
  Input,
} from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { sendOtp } from "@/lib/otp/service";

const UZ_PHONE = /^\+998\d{9}$/;

export default async function PhonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("phone");
  const user = await requireUserAtStep(locale, "phone_input");

  const errMsg =
    error === "invalid"
      ? "Неверный формат номера. Используйте +998 и 9 цифр."
      : error === "rate_limit"
        ? "Слишком много попыток. Подождите минуту и попробуйте снова."
        : null;

  async function submit(formData: FormData) {
    "use server";
    const raw = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");
    const phone = raw.startsWith("+") ? raw : `+998${raw.replace(/^998/, "")}`;
    if (!UZ_PHONE.test(phone)) {
      redirect(`/${locale}${ONBOARDING_PATHS.phone_input}?error=invalid`);
    }
    const result = await sendOtp(user.id, phone);
    if (!result.ok) {
      redirect(`/${locale}${ONBOARDING_PATHS.phone_input}?error=rate_limit`);
    }
    await transition(
      user.id,
      { phone_number: phone, onboarding_step: "otp_pending" },
      "phone submitted",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.otp_pending}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <form action={submit} className="flex flex-col gap-4">
          {errMsg ? (
            <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
              {errMsg}
            </p>
          ) : null}
          <Field label={t("label")} hint="Мы отправим SMS с кодом подтверждения">
            <Input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+998 XX XXX XX XX"
              defaultValue={user.phone_number ?? "+998"}
              required
            />
          </Field>
          <PrimaryButton type="submit">{t("submit")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
