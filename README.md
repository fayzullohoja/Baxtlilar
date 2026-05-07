# Bakhtlilar

Telegram Mini App MVP — верифицированные серьёзные знакомства в Узбекистане.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Supabase** — Postgres, Storage, ручная модерация
- **Telegram Mini App SDK** (`@telegram-apps/sdk-react`)
- **next-intl** — ru / uz
- **Tailwind v4** + кастомные компоненты

Деплой: Vercel.

## Документация

- `docs/state-machine.md` — единый source-of-truth для роутинга, статусов, доступов. Перед добавлением нового экрана читай этот файл.

## Локальный запуск

1. `cp .env.example .env.local` (или открой существующий `.env.local`)
2. Скопируй `service_role` ключ из Supabase Dashboard → API Keys → `secret` и вставь в `SUPABASE_SERVICE_ROLE_KEY`
3. (опционально) укажи `TELEGRAM_BOT_TOKEN` и выключи `DEV_BYPASS_TG`. В dev-режиме `DEV_BYPASS_TG=1` создаёт фейкового пользователя при первом открытии — приложение работает в обычном браузере.
4. `pnpm dev` → http://localhost:3000 (редирект на `/ru` или `/uz`)

## OTP в dev

`SMS_PROVIDER=mock` — реальный код пишется в console.log, а код `123456` всегда принимается.

## Что готово

- 25 экранов онбординга (1–25), все шаги двигают `user.onboarding_step`.
- State machine с явным `nextScreenFor(user)`; при открытии `/` — редирект на нужный экран.
- Welcome → Language → Security → Phone → OTP — формы и server actions реализованы.
- Document + Liveness — реальная загрузка в Supabase Storage (private bucket `documents`).
- Moderation — submitted / pending / rejected / approved.
- Profile basic → about — заглушки (`StubScreen`), state двигают; preview — реальный.
- Quiz intro / questions / result — заглушки + финальный переход в `active`.
- i18n на ru + uz.
- Audit log: `user_state_transitions` записывается на каждый переход.

## TODO (после первого коммита)

- Реальные формы анкеты (8 экранов профиля) с Zod-валидацией.
- 12 вопросов квиза + scoring → `quiz_results`.
- Реальная Telegram initData валидация (с `BOT_TOKEN`).
- Реальный SMS-провайдер (Eskiz / Playmobile).
- Админка модерации.
- RLS-политики на таблицы.
- Активный продукт: рекомендации, запросы, чаты.

## Главное правило

> Без OTP — нет паспорта. Без паспорта — нет анкеты. Без модерации — нет рекомендаций. Без квиза — нет matching. Без взаимного согласия — нет чата.

См. `docs/state-machine.md`, раздел 7.
