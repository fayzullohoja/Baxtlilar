# Changelog

## Audit sweep — May 2026

10 rounds of systematic audit + fix, ~80 issues addressed across security,
correctness, UX, and observability. **100 tests, 0 red.**

### Round 1 — `c2c4d68`

- **P0 sec:** `requireAdmin()` helper in admin server actions (was: action-ID
  replay possible after logout)
- **P0 correctness:** `requireUserAtStep()` — onboarding pages now enforce
  state, can't be skipped via direct URL
- **P0 UX:** error banners on phone/document/liveness/profile/photos
- **P1 abuse:** OTP send rate limit (1/min, 5/hour per user)

### Round 2 — `cebf27d`

- Admin reset-onboarding tool (closes the user-blocked-on-profile use case)
- Quiz answer value validation (option-set whitelist)
- Welcome page redirects already-active users to /main
- OTP resend cooldown countdown UI

### Round 3 — `c630453`

- Profile preview with all sections + edit links
- Magic-byte MIME validation (defends vs file.type spoofing)
- Admin login rate limit (5 fails per IP / 15-min lockout)

### Round 4 — `359399d`

- /main lifecycle gate (blocked → /blocked)
- Removed dead /onboarding/moderation/approved route
- /api/health endpoint with DB ping
- +14 unit tests for new code

### Round 5 — `3da1076`

- Security headers via next.config: HSTS, X-Content-Type-Options,
  Permissions-Policy, CSP with frame-ancestors for Telegram
- Bootstrap rate limit (10 per IP per hour)
- Account deletion (/settings) with full data wipe
- Client-side photo compression before upload (1280px / 0.85 JPEG)

### Round 6 — `fbebbbe`

- Bootstrap-throttle tests
- Profile preview completeness % progress bar
- Photo thumbnails in /admin/users (one batched signed-URL query)

### Round 7 — `cc15f31`

- Optimistic concurrency in `transition()` — guards against lost-update
- Phone normalization library + 9 tests (8/9-digit short forms,
  international format, Russian/US country code rejection)
- /blocked page with reason + support link

### Round 8 — `c7613ef`

- Global error.tsx + not-found.tsx
- Profile preview confirm disabled when incomplete (proactive UX)
- TG notifyUserTelegram() on admin approve/reject — closes the loop
- Integration test for transition() concurrency conflict

### Round 9 — `ce43d6b`

- Auto-promote next extra to main when user deletes main photo
  (was: user got stuck without main, "Continue" disabled forever)
- Photo count limit enforcement (max 4 extras)
- Admin signed URL TTL: 1h → 4h
- /api/health includes git commit/branch/deployment_id

### Round 10 — _this commit_

- Stale moderation queue: pending > 24h shows "⚠ Просрочено" red badge
- /api/health route tests (mocked DB)
- This CHANGELOG

## Test coverage growth

| Round | Total | Unit | Integration |
|-------|-------|------|-------------|
| Pre-audit | 69 | 34 | 35 |
| 4 | 83 | 48 | 35 |
| 6 | 86 | 51 | 35 |
| 7 | 95 | 60 | 35 |
| 8 | 97 | 60 | 37 |
| 10 | **100** | 63 | 37 |
