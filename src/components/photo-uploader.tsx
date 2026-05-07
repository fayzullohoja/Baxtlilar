"use client";

import { useRef, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/screen";

export function PhotoUploader({
  uploadAction,
  labels,
  captureMode,
}: {
  uploadAction: (fd: FormData) => Promise<void>;
  labels: {
    pick: string;
    use: string;
    retake: string;
    uploading: string;
    error: string;
  };
  captureMode: "user" | "environment";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function submit() {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      try {
        await uploadAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : labels.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={captureMode}
        className="hidden"
        onChange={onFileChange}
      />
      {preview ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="block w-full" />
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white text-sm text-neutral-500">
          {labels.pick}
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!preview ? (
        <PrimaryButton onClick={pick}>{labels.pick}</PrimaryButton>
      ) : (
        <>
          <PrimaryButton onClick={submit} disabled={pending}>
            {pending ? labels.uploading : labels.use}
          </PrimaryButton>
          <SecondaryButton onClick={pick} disabled={pending}>
            {labels.retake}
          </SecondaryButton>
        </>
      )}
    </div>
  );
}
