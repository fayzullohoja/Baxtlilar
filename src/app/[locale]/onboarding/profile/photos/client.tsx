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
        <div className={`relative overflow-hidden rounded-xl border border-neutral-200 ${size}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          {removeAction && photoId ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/60 text-xs text-white"
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
          className={`flex ${size} items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white text-3xl text-neutral-400 hover:border-neutral-900`}
        >
          {pending ? labels.uploading : labels.pick}
        </button>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
