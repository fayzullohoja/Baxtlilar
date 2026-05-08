import "server-only";

/**
 * Verifies the file's content matches one of the allowed image formats by
 * checking magic-byte signatures. Defends against client-set file.type
 * spoofing (e.g. malicious renaming `payload.exe` → `pic.jpg`).
 *
 * Returns the detected type, or null if not a recognized image.
 */
export async function detectImageType(
  file: File,
): Promise<"jpeg" | "png" | "webp" | "heic" | null> {
  // Read just enough bytes to identify each format.
  const headerBytes = await file.slice(0, 16).arrayBuffer();
  const head = new Uint8Array(headerBytes);

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "png";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "webp";
  }
  // HEIC/HEIF: bytes 4..11 contain "ftypheic" or "ftypmif1" or "ftypheix"
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    if (
      brand === "heic" ||
      brand === "heix" ||
      brand === "mif1" ||
      brand === "msf1" ||
      brand === "hevc" ||
      brand === "hevx"
    ) {
      return "heic";
    }
  }
  return null;
}
