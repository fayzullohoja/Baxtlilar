"use client";

import { useState, useTransition } from "react";
import { PrimaryButton } from "@/components/ui/screen";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function WelcomeBootstrap({
  startAction,
  startLabel,
}: {
  startAction: (initData?: string) => Promise<void>;
  startLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onStart() {
    setError(null);
    if (typeof window !== "undefined") {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
    }
    const initData = window.Telegram?.WebApp?.initData ?? "";
    startTransition(async () => {
      try {
        await startAction(initData || undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bootstrap error");
      }
    });
  }

  return (
    <>
      <PrimaryButton onClick={onStart} disabled={pending}>
        {pending ? "…" : startLabel}
      </PrimaryButton>
      {error ? (
        <p className="mt-2 rounded-2xl bg-[--color-danger-bg] px-4 py-2 text-center text-xs text-[--color-danger]">
          {error}
        </p>
      ) : null}
    </>
  );
}
