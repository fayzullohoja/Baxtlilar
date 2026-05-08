import { describe, it, expect } from "vitest";
import { normalizeUzPhone } from "./phone";

describe("normalizeUzPhone", () => {
  it("accepts already-formatted +998 number", () => {
    expect(normalizeUzPhone("+998901234567")).toBe("+998901234567");
  });

  it("strips spaces and parens", () => {
    expect(normalizeUzPhone("+998 90 123 45 67")).toBe("+998901234567");
    expect(normalizeUzPhone("+998 (90) 123-45-67")).toBe("+998901234567");
  });

  it("adds + when missing", () => {
    expect(normalizeUzPhone("998901234567")).toBe("+998901234567");
  });

  it("expands short 9-digit form to +998", () => {
    expect(normalizeUzPhone("901234567")).toBe("+998901234567");
    expect(normalizeUzPhone("90 123 45 67")).toBe("+998901234567");
  });

  it("strips leading 8 trunk prefix", () => {
    expect(normalizeUzPhone("8901234567")).toBe("+998901234567");
  });

  it("rejects too-short numbers", () => {
    expect(normalizeUzPhone("12345")).toBeNull();
    expect(normalizeUzPhone("")).toBeNull();
  });

  it("rejects too-long numbers", () => {
    expect(normalizeUzPhone("+998901234567890")).toBeNull();
  });

  it("rejects non-Uzbek country codes", () => {
    expect(normalizeUzPhone("+12025550100")).toBeNull(); // US
    expect(normalizeUzPhone("+74951234567")).toBeNull(); // RU
  });

  it("handles strings with leading/trailing whitespace", () => {
    expect(normalizeUzPhone("  +998 90 123 45 67  ")).toBe("+998901234567");
  });
});
