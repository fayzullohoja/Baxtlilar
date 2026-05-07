<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

Next.js 16 has breaking changes from your training data. Read `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Quick reference

- `cookies()`, `headers()`, `params` — **async**, always `await`.
- `middleware.ts` deprecated → `proxy.ts`. We keep `middleware.ts` for next-intl compatibility (warning is OK).
- `cacheComponents` (PPR) is **off** — all our pages read session cookie and are dynamic.
- Server Actions return `void | Promise<void>`. To signal errors, `redirect(...?error=...)` rather than returning.

## Project conventions

- Source of truth for routing/statuses: `docs/state-machine.md`. Read before adding screens or changing transitions.
- Every state mutation goes through `transition(userId, patch, reason)` from `@/lib/state-machine/transitions`. This writes to `user_state_transitions` audit log.
- After each state mutation, redirect using `nextScreenFor(user)` or `ONBOARDING_PATHS[step]`. Never hard-code `/onboarding/foo` paths in page code.
- Server-only code: import `"server-only"` at top. Service-role Supabase client is `@/lib/supabase/admin`.
- Client components: file ends with `client.tsx` next to its server `page.tsx`, marked `"use client"` at top.
- i18n keys: `messages/ru.json` and `messages/uz.json`. Keep keys in sync.

## What NOT to do

- Don't query Supabase from the browser. All DB access goes through server actions using `supabaseAdmin`.
- Don't bypass `transition()` to write `onboarding_step` directly. The audit log matters.
- Don't return error objects from server actions — redirect with `?error=...` instead.
- Don't store sensitive secrets in `NEXT_PUBLIC_*` vars — those leak to the client.
