/**
 * Sets the Telegram bot's command menu (the "/" picker shown in chat).
 *
 * Run once after BotFather setup, or whenever you change commands:
 *   node scripts/tg-set-commands.mjs
 *
 * Reads TELEGRAM_BOT_TOKEN from .env.local.
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

const COMMANDS = [
  { command: "start", description: "Открыть Bakhtlilar" },
  { command: "help", description: "Помощь и поддержка" },
  { command: "rules", description: "Правила сервиса" },
];

async function main() {
  console.log("Setting bot commands…");
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commands: COMMANDS, language_code: "ru" }),
  });
  const body = await res.json();
  if (!body.ok) {
    console.error("Failed:", body);
    process.exit(1);
  }
  console.log("✓ Commands set:");
  COMMANDS.forEach((c) => console.log(`  /${c.command} — ${c.description}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
