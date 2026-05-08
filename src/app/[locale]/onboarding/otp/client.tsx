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
        <span className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
          {labels.input}
        </span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-16 rounded-2xl border border-[--color-line] bg-[--color-blush-soft] px-4 text-center text-3xl font-semibold tracking-[0.5em] text-[--color-plum]"
          required
        />
      </label>
      {initialError === "invalid" ? (
        <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-center text-sm text-[--color-danger]">
          {labels.invalid}
        </p>
      ) : null}
      {initialError === "too_many" ? (
        <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-center text-sm text-[--color-danger]">
          {labels.tooMany}
        </p>
      ) : null}
      {labels.devHint ? (
        <p className="rounded-2xl border border-[--color-brand-border] bg-[--color-blush] px-4 py-2 text-center text-xs text-[--color-brand-deep]">
          {labels.devHint}
        </p>
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
