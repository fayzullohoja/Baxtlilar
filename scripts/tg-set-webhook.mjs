/**
 * Configures the Telegram bot webhook to point at our /api/tg/webhook handler.
 * Run once after first deploy, or when you change the webhook URL.
 *
 *   node scripts/tg-set-webhook.mjs                   # uses APP_URL from .env.local
 *   node scripts/tg-set-webhook.mjs --delete          # unregisters the webhook
 *   node scripts/tg-set-webhook.mjs --info            # show current webhook info
 *
 * Reads TELEGRAM_BOT_TOKEN, APP_URL, TELEGRAM_WEBHOOK_SECRET from .env.local.
 * If TELEGRAM_WEBHOOK_SECRET is set, configures the webhook to require it
 * (defends against spoofed POSTs to /api/tg/webhook).
 */
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN missing in .env.local");
  process.exit(1);
}
const appUrl = process.env.APP_URL ?? "https://baxtlilar.vercel.app";
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

const action = process.argv.find((a) => a.startsWith("--"))?.slice(2) ?? "set";

async function main() {
  if (action === "info") {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const body = await res.json();
    console.log(JSON.stringify(body.result, null, 2));
    return;
  }

  if (action === "delete") {
    console.log("Deleting webhook…");
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const body = await res.json();
    console.log(body.ok ? "✓ deleted" : `✗ ${JSON.stringify(body)}`);
    return;
  }

  // set (default)
  const url = `${appUrl.replace(/\/$/, "")}/api/tg/webhook`;
  console.log(`Setting webhook to: ${url}`);
  if (secret) console.log(`  with secret: ${secret.slice(0, 4)}…`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      ...(secret ? { secret_token: secret } : {}),
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const body = await res.json();
  if (body.ok) {
    console.log("✓ webhook set");
    console.log("\nVerify:");
    console.log(`  node scripts/tg-set-webhook.mjs --info`);
  } else {
    console.error("✗ failed:", body);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
