import "server-only";

/**
 * Sends a Telegram notification to the admin chat.
 * No-op if `ADMIN_TG_CHAT_ID` env var is not configured.
 *
 * Failures (network, 4xx, etc) are swallowed and logged — admin notifications
 * must never block user flows.
 */
export async function notifyAdminTelegram(text: string): Promise<void> {
  const chatId = process.env.ADMIN_TG_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      // Hard timeout — never let this block the request
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[notify-admin] TG ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("[notify-admin] failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Sends a Telegram message to a specific user (their telegram_id).
 * Used to close the moderation loop — when admin approves/rejects, the
 * user gets immediate feedback in their TG client.
 */
export async function notifyUserTelegram(
  telegramId: number,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // 403 means user blocked the bot — expected, log quietly
      const body = await res.text();
      if (res.status !== 403) {
        console.warn(`[notify-user] TG ${res.status}: ${body.slice(0, 200)}`);
      }
    }
  } catch (err) {
    console.warn("[notify-user] failed:", err instanceof Error ? err.message : err);
  }
}

export function buildSubmissionMessage(opts: {
  userId: string;
  name: string | null;
  username: string | null;
  telegramId: number;
  queueLength: number;
  appUrl?: string;
}): string {
  const { userId, name, username, telegramId, queueLength, appUrl } = opts;
  const display = name ?? "Без имени";
  const handle = username ? ` (@${username})` : "";
  const link = appUrl
    ? `\n\n<a href="${appUrl}/admin/moderation/${userId}">Открыть карточку →</a>`
    : "";
  return [
    `🔔 <b>Новая заявка на модерацию</b>`,
    "",
    `👤 ${display}${handle}`,
    `📱 TG ID: <code>${telegramId}</code>`,
    `📊 В очереди: <b>${queueLength}</b>`,
    link,
  ].join("\n");
}
