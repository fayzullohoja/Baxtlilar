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
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { sendOtp } from "@/lib/otp/service";

const UZ_PHONE = /^\+998\d{9}$/;

export default async function PhonePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("phone");
  const user = await requireUser(locale);

  async function submit(formData: FormData) {
    "use server";
    const raw = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");
    const phone = raw.startsWith("+") ? raw : `+998${raw.replace(/^998/, "")}`;
    if (!UZ_PHONE.test(phone)) {
      redirect(`/${locale}${ONBOARDING_PATHS.phone_input}?error=invalid`);
    }
    await transition(
      user.id,
      { phone_number: phone, onboarding_step: "otp_pending" },
      "phone submitted",
    );
    await sendOtp(user.id, phone);
    redirect(`/${locale}${ONBOARDING_PATHS.otp_pending}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <form action={submit} className="flex flex-col gap-4">
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
