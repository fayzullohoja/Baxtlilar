import { describe, it, expect } from "vitest";
import { detectImageType } from "./mime-check";

function fileFromBytes(bytes: number[], type = "application/octet-stream"): File {
  return new File([new Uint8Array(bytes)], "test.bin", { type });
}

describe("detectImageType", () => {
  it("identifies JPEG by FF D8 FF prefix", async () => {
    const f = fileFromBytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(await detectImageType(f)).toBe("jpeg");
  });

  it("identifies PNG by 89 50 4E 47 0D 0A 1A 0A header", async () => {
    const f = fileFromBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(await detectImageType(f)).toBe("png");
  });

  it("identifies WebP by RIFF...WEBP", async () => {
    const f = fileFromBytes([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
      0, 0, 0, 0,
    ]);
    expect(await detectImageType(f)).toBe("webp");
  });

  it("identifies HEIC (ftypheic brand)", async () => {
    const f = fileFromBytes([
      0, 0, 0, 0,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
      0, 0, 0, 0,
    ]);
    expect(await detectImageType(f)).toBe("heic");
  });

  it("identifies HEIF variant (ftypmif1 brand)", async () => {
    const f = fileFromBytes([
      0, 0, 0, 0,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x6d, 0x69, 0x66, 0x31, // mif1
      0, 0, 0, 0,
    ]);
    expect(await detectImageType(f)).toBe("heic");
  });

  it("rejects PDF (%PDF magic)", async () => {
    const f = fileFromBytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(await detectImageType(f)).toBeNull();
  });

  it("rejects PE/Windows executable (MZ header)", async () => {
    const f = fileFromBytes([0x4d, 0x5a, 0x90, 0x00]);
    expect(await detectImageType(f)).toBeNull();
  });

  it("rejects empty file", async () => {
    const f = new File([new Uint8Array(0)], "empty.jpg", { type: "image/jpeg" });
    expect(await detectImageType(f)).toBeNull();
  });

  it("rejects file with spoofed image/jpeg MIME but PDF bytes", async () => {
    // Even though file.type says image/jpeg, the bytes betray the lie.
    const f = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
      "fake.jpg",
      { type: "image/jpeg" },
    );
    expect(await detectImageType(f)).toBeNull();
  });
});
