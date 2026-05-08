/**
 * Telegram bot webhook handler.
 *
 * Setup once:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://baxtlilar.vercel.app/api/tg/webhook&secret_token=<RANDOM>"
 *
 * Set the secret in Vercel env as TELEGRAM_WEBHOOK_SECRET so this route can
 * verify legitimate Telegram callbacks via the X-Telegram-Bot-Api-Secret-Token
 * header.
 *
 * Handles:
 *   /start, /help, /rules — replies with text + Mini App button
 *   anything else — friendly fallback pointing to the Mini App
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TgUpdate {
  message?: {
    chat: { id: number };
    from?: { first_name?: string };
    text?: string;
  };
}

const APP_URL = process.env.APP_URL ?? "https://baxtlilar.vercel.app";
const SUPPORT_USERNAME =
  process.env.SUPPORT_TG_USERNAME ?? "baxtlilar_support";

export async function POST(req: NextRequest) {
  // Verify the request actually came from Telegram (only if secret is set).
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return NextResponse.json({ ok: false, error: "bad_secret" }, { status: 403 });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "no_bot_token" }, { status: 500 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text) {
    return NextResponse.json({ ok: true });
  }

  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name ?? "";

  let reply = "";
  if (/^\/start\b/.test(text)) {
    reply = [
      `👋 Здравствуйте${firstName ? ", " + firstName : ""}!`,
      "",
      "Bakhtlilar — приложение для серьёзных знакомств с проверкой профилей.",
      "Откройте Mini App, чтобы начать.",
    ].join("\n");
  } else if (/^\/help\b/.test(text)) {
    reply = [
      "📚 <b>Помощь</b>",
      "",
      "/start — открыть приложение",
      "/rules — правила сервиса",
      "/help — это сообщение",
      "",
      `По любым вопросам пишите @${SUPPORT_USERNAME}`,
    ].join("\n");
  } else if (/^\/rules\b/.test(text)) {
    reply = [
      "📖 <b>Правила сервиса</b>",
      "",
      "1. Указывайте достоверные данные",
      "2. Загружайте свои реальные фото",
      "3. Уважительное общение со всеми",
      "4. Серьёзные намерения — без свайпов и пустых разговоров",
      "5. Запрещены: спам, фейки, оскорбления, попрошайничество",
      "",
      "Подробнее в Mini App.",
    ].join("\n");
  } else {
    reply = "Откройте Mini App, чтобы продолжить. /help для списка команд.";
  }

  await sendMessage(token, chatId, reply, APP_URL);
  return NextResponse.json({ ok: true });
}

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  miniAppUrl: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть Bakhtlilar",
                web_app: { url: miniAppUrl },
              },
            ],
          ],
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[tg webhook] sendMessage failed:", err);
  }
}
