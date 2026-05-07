import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "a".repeat(64);
});

describe("session encode/decode", () => {
  it("round-trips a user id", async () => {
    const { encodeSession, decodeSession } = await import("./session");
    const tok = encodeSession("user-123");
    const payload = decodeSession(tok);
    expect(payload?.user_id).toBe("user-123");
  });

  it("rejects tampered token", async () => {
    const { encodeSession, decodeSession } = await import("./session");
    const tok = encodeSession("user-123");
    // flip a single character of the body
    const [body, sig] = tok.split(".");
    const tampered = body.slice(0, -1) + (body.slice(-1) === "A" ? "B" : "A") + "." + sig;
    expect(decodeSession(tampered)).toBeNull();
  });

  it("rejects expired token", async () => {
    const { decodeSession } = await import("./session");
    // Manually craft an expired payload with a valid signature
    const crypto = await import("node:crypto");
    const expiredPayload = {
      user_id: "x",
      iat: 0,
      exp: Math.floor(Date.now() / 1000) - 10,
    };
    const body = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET!)
      .update(body)
      .digest("base64url");
    expect(decodeSession(`${body}.${sig}`)).toBeNull();
  });
});
