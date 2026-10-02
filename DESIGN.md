# DESIGN

## Architecture

Two self-contained services:

- **`backend/`** — Node 20, Express 4, TypeScript, Prisma ORM over SQLite. Stateless HTTP API, JWT sessions.
- **`mobile/`** — Expo React Native, React Navigation stack, AsyncStorage for the session, a thin typed `api()` fetch client.

Mailpit runs beside the API in `docker-compose.yml` as an SMTP catcher so OTPs are visible at `localhost:8025` without a real mail provider. The compose file is the one-command runtime the brief asks for.

```
Mobile (Expo)
   │  HTTPS/REST + Bearer JWT
   ▼
Express API ──► Prisma ──► SQLite file (./data/prod.db in Docker)
   │
   └──► nodemailer ──► Mailpit SMTP (dev)
```

### Why these choices

- **SQLite locally, Postgres in production**: SQLite keeps local setup to one command with no Docker or DB daemon — which is what the brief optimises for. But a packaged APK needs a backend on the public internet, and free hosts don't give you a persistent disk, so the deployed instance runs Postgres.

  Prisma can't take the provider from an env var, so rather than maintain two schemas I generate one from the other: `scripts/gen-prod-schema.mjs` reads `schema.prisma` and rewrites only the datasource block. The models have a single source of truth and can't drift. Production uses `prisma db push` rather than migrations — the schema is small, there's no production data to preserve, and it keeps the deploy a single step. With real users I'd switch to a Postgres migration history.

  One sharp edge this creates: `prisma generate` writes a provider-specific client into `node_modules`, so running the production build locally leaves you with a Postgres client and a broken SQLite dev environment. Rather than document a footgun, `predev` and `pretest` regenerate the local client, so the local commands are self-healing.
- **Argon2** for passwords (OWASP's current recommendation over bcrypt).
- **HMAC-SHA256** for OTP hashes, not Argon2 — the code is 6 digits with a 10-minute TTL and a 5-attempt cap, so the attack surface is bounded; HMAC with a server-side secret is enough and keeps verification cheap.
- **JWT** sessions with a long-ish expiry (`JWT_EXPIRES_IN=7d`) so the "stay logged in after restart" requirement works via AsyncStorage.
- **Zod** for request validation — one schema per route, errors mapped to a consistent `{ error: { code, message, details } }` shape by a central error middleware.
- **Expo** on the mobile side because EAS gives you an APK with one command — fastest path to a reviewable binary.

### OTP policy (implemented)

- 6-digit numeric code, generated with `crypto.randomInt`
- 10-minute TTL, single-use (consumed on success, invalidated on resend)
- Max 5 wrong attempts per code, then the row is locked and the user must resend
- 30-second resend cooldown, measured from the last code's `createdAt`
- Only the HMAC hash is stored

Covered by `tests/otp.test.ts` with an in-memory fake Prisma to keep the test fast and DB-free.

### Dashboard: the Lifestyle Manager card is deliberately mocked

The brief asks for "a simple home screen listing the selected tasks". I went further, because a flat list
undersells the product: padosipro.com's whole pitch is *"Not an app. Not a chatbot. A real person who gets it
done."* So the dashboard leads with a **Lifestyle Manager hero card** — an assigned manager, presence status,
and a "Message ___" CTA — then stats, then the selected services as a category-grouped grid.

The manager is picked client-side by hashing the user's email against a fixed list, so it's **stable per user but
not backed by any API**. Tapping the CTA opens an alert that says exactly that. I kept it mocked rather than
inventing an endpoint because manager assignment is a real staffing/ops domain, not something to fake in a
take-home. The seam is obvious: swap `pickManager()` for a `GET /api/manager/me` call and the UI is unchanged.

The "~Nh saved / week" tile is likewise a presentational estimate (`tasks × 1.5`), labelled as an estimate, not a
tracked metric.

### Business Name — why optional

PadosiPro's primary audience is households, not businesses. Making the field required would block legitimate signups. The server accepts it as optional and stores `null` when absent; the UI labels it clearly.

---

## Main trade-offs

| Trade-off | What I did | What I'd do with more time |
| --- | --- | --- |
| DB simplicity vs. prod-realism | SQLite locally, Postgres on the deploy, one generated schema | A real Postgres migration history, run in CI |
| OTP delivery | Console locally, Brevo's HTTPS API on the deploy (Render blocks outbound SMTP ports) | SES/Postmark adapter behind the same `mail.ts` seam |
| Rate limiting | Only the OTP cooldown is enforced | `express-rate-limit` on `/auth/*` globally, per-IP + per-email |
| Session store | Stateless JWT | Rotating refresh tokens stored server-side; revocation on logout |
| Tests | Risky logic only (OTP + hashing) | Supertest-level integration tests for every route + Detox E2E on the app |
| State management | React Context + fetch | React Query for cache/refetch, zustand if context fans out |
| Error UX | Server messages shown verbatim | i18n layer, typed `code` → message map on the client |
| Phone verification | Email only, as the brief asks | +91 OTP via SMS gateway for the profile mobile number |
| Manager assignment | Mocked client-side, clearly flagged in-app | `GET /api/manager/me` backed by a real staffing table |

---

## What's intentionally out of scope

- Password reset flow (no requirement in the brief)
- Social auth / Google sign-in
- Push notifications
- Analytics / crash reporting (Sentry etc.)
- A real icon/splash set — placeholders only
- iOS build artifacts (requires a paid Apple account; Android APK is sufficient per the brief)

---

## What I'd do next with another week

1. **Integration tests** against a disposable Postgres via Testcontainers — cover every route and the "already verified" / "unverified login" edge cases end-to-end.
2. **Rate limiting** middleware with Redis so limits survive restarts and work behind multiple API nodes.
3. **Refresh tokens** so the access token can be short-lived and revocable.
4. **CI**: GitHub Actions matrix running backend tests + `expo-doctor` + `tsc --noEmit` on the app on every PR.
5. **Polish pass on the UI**: real brand icon, nicer empty states on Home, pull-to-refresh animations, dark mode token set.
6. **Observability**: pino structured logs on the API, request IDs plumbed through to the client, Sentry on the app.
7. **Secrets management**: move `JWT_SECRET` and SMTP creds out of `.env` into Doppler/1Password for the hosted env.
