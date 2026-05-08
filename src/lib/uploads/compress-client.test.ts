/**
 * Tests the lightweight skip path of compressImage. Real compression needs
 * canvas + Image API which JSDOM doesn't fully implement — exercise the
 * fallback returns without going through the canvas branch.
 */
import { describe, it, expect } from "vitest";
import { compressImage } from "./compress-client";

describe("compressImage skip-condition", () => {
  it("returns the original file unchanged when smaller than threshold", async () => {
    const small = new File(
      [new Uint8Array(100_000)], // 100KB
      "tiny.jpg",
      { type: "image/jpeg" },
    );
    const out = await compressImage(small);
    expect(out).toBe(small);
  });

  it("returns the original file when document is undefined (server-side)", async () => {
    // In a Node test, `document` is not defined unless jsdom is configured.
    // The library's check for typeof document !== "undefined" must hold.
    // Even with a 5MB file, we should fall through to returning the original.
    const big = new File(
      [new Uint8Array(5 * 1024 * 1024)],
      "big.jpg",
      { type: "image/jpeg" },
    );
    const out = await compressImage(big);
    expect(out).toBe(big);
  });
});
