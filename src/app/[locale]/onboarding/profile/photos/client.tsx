"use client";

import { useRef, useState, useTransition } from "react";

export function PhotoSlot({
  previewUrl,
  uploadAction,
  removeAction,
  photoId,
  position,
  compact,
  labels,
}: {
  previewUrl: string | null;
  uploadAction: (fd: FormData) => Promise<void>;
  removeAction: ((fd: FormData) => Promise<void>) | null;
  photoId: string | null;
  position?: number;
  compact?: boolean;
  labels: {
    pick: string;
    use: string;
    retake: string;
    uploading: string;
    error: string;
  };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", f);
    if (position != null) fd.append("position", String(position));
    startTransition(async () => {
      try {
        await uploadAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
      }
    });
  }

  function remove() {
    if (!removeAction || !photoId) return;
    setError(null);
    const fd = new FormData();
    fd.append("id", photoId);
    startTransition(async () => {
      try {
        await removeAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
      }
    });
  }

  const size = compact ? "h-32" : "h-48";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={onChange}
      />
      {previewUrl ? (
        <div className={`relative overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)] ${size}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          {removeAction && photoId ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base text-[--color-plum] shadow-[0_2px_8px_rgba(74,44,53,0.2)] transition hover:bg-white"
              aria-label="remove"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={pending}
          className={`flex ${size} flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[--color-brand-border] bg-[--color-blush-soft] text-2xl text-[--color-brand-deep] transition hover:border-[--color-brand] hover:bg-[--color-blush]`}
        >
          <span aria-hidden>{pending ? "…" : "+"}</span>
          <span className="text-xs font-semibold text-[--color-plum-soft]">
            {pending ? labels.uploading : labels.pick}
          </span>
        </button>
      )}
      {error ? (
        <p className="rounded-xl bg-[--color-danger-bg] px-3 py-1.5 text-center text-xs text-[--color-danger]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
