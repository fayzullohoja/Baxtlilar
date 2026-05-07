"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/screen";

export function OtpForm({
  verifyAction,
  resendAction,
  labels,
  initialError,
}: {
  verifyAction: (fd: FormData) => Promise<void>;
  resendAction: () => Promise<void>;
  labels: {
    input: string;
    submit: string;
    resend: string;
    invalid: string;
    tooMany: string;
    devHint: string | null;
  };
  initialError: "invalid" | "too_many" | null;
}) {
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await verifyAction(fd);
        })
      }
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">
          {labels.input}
        </span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-14 rounded-xl border border-neutral-300 bg-white px-4 text-center text-2xl tracking-[0.5em] focus:border-neutral-900 focus:outline-none"
          required
        />
      </label>
      {initialError === "invalid" ? (
        <p className="text-sm text-red-600">{labels.invalid}</p>
      ) : null}
      {initialError === "too_many" ? (
        <p className="text-sm text-red-600">{labels.tooMany}</p>
      ) : null}
      {labels.devHint ? (
        <p className="text-xs text-neutral-500">{labels.devHint}</p>
      ) : null}
      <PrimaryButton type="submit" disabled={pending || code.length !== 6}>
        {pending ? "…" : labels.submit}
      </PrimaryButton>
      <SecondaryButton
        type="button"
        disabled={resending}
        onClick={() =>
          startResend(async () => {
            await resendAction();
          })
        }
      >
        {labels.resend}
      </SecondaryButton>
    </form>
  );
}
