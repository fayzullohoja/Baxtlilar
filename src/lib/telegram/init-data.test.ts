import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { parseInitData, validateInitData, devFakeInitData } from "./init-data";

describe("parseInitData", () => {
  it("parses user JSON", () => {
    const initData = devFakeInitData(42, "Test");
    const parsed = parseInitData(initData);
    expect(parsed.user?.id).toBe(42);
    expect(parsed.user?.first_name).toBe("Test");
  });
});

describe("validateInitData", () => {
  it("DEV_BYPASS_TG accepts unsigned data", () => {
    process.env.DEV_BYPASS_TG = "1";
    process.env.TELEGRAM_BOT_TOKEN = "anything";
    const parsed = validateInitData(devFakeInitData(7, "DevUser"));
    expect(parsed?.user?.id).toBe(7);
  });

  it("rejects bad HMAC when DEV_BYPASS_TG=0", () => {
    process.env.DEV_BYPASS_TG = "0";
    process.env.TELEGRAM_BOT_TOKEN = "test_bot_token";
    const parsed = validateInitData(devFakeInitData(7, "Hacker"));
    expect(parsed).toBeNull();
  });

  it("accepts valid HMAC", () => {
    process.env.DEV_BYPASS_TG = "0";
    const token = "test_bot_token";
    process.env.TELEGRAM_BOT_TOKEN = token;
    const params = new URLSearchParams({
      user: JSON.stringify({ id: 99, first_name: "Real" }),
      auth_date: String(Math.floor(Date.now() / 1000)),
    });
    const dataCheckString = Array.from(params.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
    const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
    params.set("hash", hash);
    const parsed = validateInitData(params.toString());
    expect(parsed?.user?.id).toBe(99);
  });
});
