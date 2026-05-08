/**
 * Tests the TG webhook handler. Mocks fetch so we can assert what gets sent
 * back to Telegram without hitting the real API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture every outgoing fetch call
const fetchCalls: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "fake_token";
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

const { POST } = await import("./route");

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/tg/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("/api/tg/webhook", () => {
  it("/start triggers welcome reply with web_app button", async () => {
    const res = await POST(
      makeRequest({
        message: {
          chat: { id: 12345 },
          from: { first_name: "Алишер" },
          text: "/start",
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(fetchCalls).toHaveLength(1);
    const body = JSON.parse(fetchCalls[0].init?.body as string);
    expect(body.chat_id).toBe(12345);
    expect(body.text).toContain("Алишер");
    expect(body.text).toContain("Bakhtlilar");
    expect(body.reply_markup.inline_keyboard[0][0].web_app).toBeDefined();
  });

  it("/help dispatches help reply", async () => {
    const res = await POST(
      makeRequest({
        message: { chat: { id: 1 }, text: "/help" },
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(fetchCalls).toHaveLength(1);
    const body = JSON.parse(fetchCalls[0].init?.body as string);
    expect(body.text).toContain("Помощь");
  });

  it("/rules dispatches rules reply", async () => {
    const res = await POST(
      makeRequest({
        message: { chat: { id: 1 }, text: "/rules" },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(fetchCalls[0].init?.body as string);
    expect(body.text).toContain("Правила");
  });

  it("falls back to generic reply for unknown commands", async () => {
    const res = await POST(
      makeRequest({
        message: { chat: { id: 1 }, text: "hello" },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(fetchCalls[0].init?.body as string);
    expect(body.text).toContain("Mini App");
  });

  it("ignores message without text", async () => {
    const res = await POST(
      makeRequest({ message: { chat: { id: 1 } } }) as never,
    );
    expect(res.status).toBe(200);
    expect(fetchCalls).toHaveLength(0);
  });

  it("rejects with 403 when secret header doesn't match", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected";
    const res = await POST(
      makeRequest(
        { message: { chat: { id: 1 }, text: "/start" } },
        { "x-telegram-bot-api-secret-token": "wrong" },
      ) as never,
    );
    expect(res.status).toBe(403);
    expect(fetchCalls).toHaveLength(0);
  });

  it("accepts when secret header matches", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected";
    const res = await POST(
      makeRequest(
        { message: { chat: { id: 1 }, text: "/start" } },
        { "x-telegram-bot-api-secret-token": "expected" },
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(fetchCalls).toHaveLength(1);
  });

  it("returns 400 on bad JSON", async () => {
    const req = new Request("http://localhost/api/tg/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{{",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 500 when bot token missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const res = await POST(
      makeRequest({
        message: { chat: { id: 1 }, text: "/start" },
      }) as never,
    );
    expect(res.status).toBe(500);
  });
});
