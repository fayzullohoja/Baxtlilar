"use client";

/**
 * Browser-side image compression. Reduces large phone photos (often 5–10MB)
 * down to ~1.5MB max edge 1280px JPEG before uploading. HEIC files can't
 * always be canvas-decoded (Safari only); we fall back to original file.
 *
 * Returns the original file unchanged if it's already small or compression
 * fails — never blocks the user.
 */
export async function compressImage(file: File): Promise<File> {
  const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024; // small enough — don't bother
  const MAX_EDGE = 1280;
  const QUALITY = 0.85;

  if (file.size < SKIP_BELOW_BYTES) return file;
  if (typeof document === "undefined") return file;

  try {
    const img = await loadImage(file);
    const { width, height } = scaleDown(img.width, img.height, MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return file;

    // If compression actually made it bigger (rare for tiny images), keep original
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function scaleDown(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
