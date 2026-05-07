import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { verifyOtp, sendOtp } from "@/lib/otp/service";
import { OtpForm } from "./client";

export default async function OtpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("otp");
  const user = await requireUser(locale);

  async function verify(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "");
    const result = await verifyOtp(user.id, code);
    if (!result.ok) {
      const reason = result.reason === "too_many" ? "too_many" : "invalid";
      redirect(`/${locale}${ONBOARDING_PATHS.otp_pending}?error=${reason}`);
    }
    await transition(
      user.id,
      {
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        verification_status: "phone_verified",
        onboarding_step: "verification_intro",
      },
      "OTP verified",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.verification_intro}`);
  }

  async function resend() {
    "use server";
    if (!user.phone_number) return;
    await sendOtp(user.id, user.phone_number);
  }

  const isDev =
    process.env.SMS_PROVIDER === "mock" || !process.env.SMS_PROVIDER;

  return (
    <Screen>
      <ScreenHeader
        title={t("title")}
        subtitle={t("body", { phone: user.phone_number ?? "" })}
      />
      <ScreenBody>
        <OtpForm
          verifyAction={verify}
          resendAction={resend}
          labels={{
            input: t("label"),
            submit: t("submit"),
            resend: t("resend"),
            invalid: t("invalid"),
            tooMany: t("too_many"),
            devHint: isDev ? t("dev_hint") : null,
          }}
          initialError={error === "invalid" ? "invalid" : error === "too_many" ? "too_many" : null}
        />
      </ScreenBody>
    </Screen>
  );
}
