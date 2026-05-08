# Bakhtlilar

Telegram Mini App MVP — верифицированные серьёзные знакомства в Узбекистане.
Не свайп-апп: рекомендация → запрос → взаимное согласие → чат.

## Stack

- **Next.js 16** (App Router, Turbopack, async cookies/headers/params)
- **React 19** Server Actions
- **Supabase** — Postgres + Storage, service_role на сервере (RLS обходится)
- **Telegram Mini App SDK** (`@telegram-apps/sdk-react`)
- **next-intl 4** — ru / uz
- **Tailwind v4** (CSS-first @theme)
- **Vitest** — 100 тестов, юнит + integration

Деплой: Vercel · база: Supabase project `fdehbwckmhqgotikpzyj`.

## Документация

- `docs/state-machine.md` — source-of-truth роутинга и состояний
- `CHANGELOG.md` — история аудит-раундов с фиксами
- `supabase/migrations/` — DDL, применять руками через Supabase SQL Editor

## Локальный запуск

```bash
cp .env.local.example .env.local   # если ещё не настроен
pnpm install
pnpm dev                            # → http://localhost:3000
```

Минимальный `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://fdehbwckmhqgotikpzyj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # из Supabase Dashboard → API → secret
SESSION_SECRET=                      # 32+ random chars
TELEGRAM_BOT_TOKEN=...               # из BotFather
DEV_BYPASS_TG=1                      # пропускает HMAC-валидацию в браузере
SMS_PROVIDER=mock                    # код 123456 всегда принимается
ADMIN_SECRET=...                     # пароль админки
ADMIN_TG_CHAT_ID=                    # (опционально) TG chat ID для уведомлений
APP_URL=http://localhost:3000        # для ссылок в TG-нотификациях
```

Производственные env-переменные стоят в Vercel project settings.

## Тесты

```bash
pnpm test                            # 63 unit-теста, мокнутые зависимости
pnpm test:full                       # + 37 integration против реального Supabase
                                     # (RUN_INTEGRATION=1 + .env.local подгружается)
```

CI ≈ 35 секунд для full.

## Структура

```
src/
├── app/
│   ├── [locale]/                    # ru / uz пользовательская часть
│   │   ├── onboarding/              # 22 экрана онбординга
│   │   ├── main/                    # /main (после онбординга)
│   │   ├── settings/                # /settings (пауза + удаление аккаунта)
│   │   ├── blocked/                 # /blocked
│   │   └── layout.tsx
│   ├── admin/                       # /admin/* — slate-look админка
│   │   ├── login/                   # IP-throttled (5 fails / 15min)
│   │   ├── moderation/              # очередь + детальная карточка
│   │   ├── users/                   # все юзеры с фильтрами
│   │   ├── banned/                  # заблокированные + unban
│   │   ├── audit/                   # лог переходов
│   │   └── stats/                   # воронка + аналитика
│   ├── api/health/                  # GET → { status, build, checks }
│   ├── error.tsx                    # global error boundary
│   ├── not-found.tsx                # custom 404
│   └── globals.css                  # Tailwind v4 + admin tokens
├── lib/
│   ├── auth/                        # session, bootstrap, throttle
│   ├── admin/                       # guard, login-throttle, notify, templates
│   ├── otp/                         # send/verify с rate limiting
│   ├── profile/                     # Zod schemas + options
│   ├── quiz/                        # 12 вопросов + scoring
│   ├── state-machine/               # routing + transition() с optimistic concurrency
│   ├── supabase/                    # lazy proxy admin client
│   └── uploads/                     # documents.ts, photos.ts, mime-check, compress-client
└── components/
    ├── admin/                       # AdminShell, KeyboardShortcuts
    ├── brand/logo.tsx               # SVG логотип Bakhtlilar
    └── ui/{screen,form}.tsx         # Field, RadioList, Input и пр.
```

## State machine

Каждый юзер имеет 5 декомпозированных полей:
`lifecycle_state · onboarding_step · verification_status · profile_completion · quiz_completion`.

Переходы только через `transition(userId, patch, reason, triggeredBy)` —
пишет в `user_state_transitions` (audit log) + проверяет `updated_at` для
optimistic concurrency.

Каждая onboarding-страница вызывает `requireUserAtStep(locale, expected)` —
если юзер не на этом шаге, его редиректит на `nextScreenFor(user)`.

## Безопасность

- HMAC-SHA256 валидация Telegram initData (см. `lib/telegram/init-data.ts`)
- Magic-byte MIME проверка для всех загрузок (защита от .exe → .jpg)
- CSP header с `frame-ancestors` allowlist для Telegram доменов
- HSTS, X-Content-Type-Options, Permissions-Policy
- IP-throttle: admin login (5/15min), bootstrap (10/час), OTP send (1/мин, 5/час)
- Service role ключ только на сервере; RLS обходится через service_role
- `requireAdmin()` внутри каждого admin server action (защита от replay)
- Account deletion стирает все данные + storage objects + сессию

## Главное правило

> Без OTP — нет паспорта. Без паспорта — нет анкеты. Без модерации — нет рекомендаций. Без квиза — нет matching. Без взаимного согласия — нет чата.

См. `docs/state-machine.md`, раздел 7.
