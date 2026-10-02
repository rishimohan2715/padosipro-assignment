# PadosiPro — Full-Stack Developer Assignment

A native mobile replica of the PadosiPro signup → verify → profile → tasks flow,
backed by a self-contained REST API. Built as a take-home for PadosiPro.

- **Backend:** Node 20 + TypeScript, Express, Prisma, SQLite, argon2, Mailpit (SMTP).
- **Mobile:** React Native (Expo), React Navigation, AsyncStorage for session persistence.

Reference app (visual + flow): https://app.padosipro.com — no WebView, every screen is native.

---

## Prerequisites

- **Node.js 20+** and **npm**
- Android Studio emulator OR the **Expo Go** app on a physical device
- Optional: **Docker** (for Mailpit) and **eas-cli** (for the APK cloud build)

---

## 1. One-time setup (from the repo root)

```bash
npm run setup
```

That installs backend + mobile deps, runs the Prisma migration, and seeds the task catalogue. Mail defaults to **console mode** — the OTP prints to the backend terminal, no SMTP/Mailpit required.

## 2. Start the backend

```bash
npm run backend         # http://localhost:4000
```

Register in the app → the 6-digit OTP shows up in this terminal in a highlighted banner. Copy it into the Verify screen.

> **Want real email instead?** Edit `backend/.env`: set `MAIL_TRANSPORT=smtp`, then either run Mailpit with Docker (`cd backend && docker compose up`) or point `SMTP_HOST`/`SMTP_PORT` at any SMTP server.

## 3. Start the mobile app (in a second terminal, from the repo root)

```bash
npm run mobile
```

Then press:

- `a` for Android emulator (API base URL defaults to `http://10.0.2.2:4000`, which maps to your host's `localhost:4000` from inside the emulator)
- `i` for iOS simulator
- Scan the QR with **Expo Go** on your phone — but note your phone must be on the same Wi-Fi as the dev machine, and you may need to update the API URL (see "Point the app at the backend" below).

### Point the app at the backend

**You normally don't need to.** The app derives the API host from the Expo dev server, so
Expo Go on a phone, the Android emulator and the iOS simulator all work out of the box.

To override (e.g. a deployed backend), set it in `mobile/app.json`:

```json
"extra": { "apiBaseUrl": "http://192.168.1.42:4000" }
```

Restart `expo start` after changing it.

### Run the tests

```bash
npm test            # from the repo root
```

**25 tests**, covering the risky logic the brief calls out:

| Area | Covered |
| --- | --- |
| OTP generation | 6 digits, HMAC-hashed at rest (never plaintext), ~10 min TTL |
| OTP expiry | expired codes rejected with `otp_expired` |
| Attempt limits | locks after 5 wrong tries — the correct code is refused too |
| Single use | code is consumed on success, resend invalidates the previous one |
| Resend cooldown | 30s enforced, returns `otp_cooldown` |
| **Login rules** | unverified → `email_not_verified` (never a token); verified → JWT; wrong password and unknown email return an **identical** 401 so login can't enumerate accounts; email is case-insensitive |
| Passwords | argon2 hashes, no plaintext stored, never returned in responses |
| Auth guard | missing/invalid bearer token → 401 on protected routes |
| Validation | +91 mobile format, short passwords, malformed emails, duplicate signup |

`tests/otp.test.ts` unit-tests the OTP service against an in-memory store;
`tests/auth.routes.test.ts` drives the real Express app with supertest against a
throwaway SQLite database that's created and dropped per run.

---

## 4. The full flow (how to try it)

1. Open the app → **Register** with any email + password (min 8 chars).
2. Look at the **backend terminal** — the 6-digit OTP is printed in a highlighted banner. (If you flipped `MAIL_TRANSPORT=smtp` + Mailpit, open **http://localhost:8025** instead.)
3. Enter the code in the **Verify** screen. On success you're logged in.
4. First-time users see the **Profile** screen (Name, +91 mobile, Address, optional Business Name).
5. Then the **Tasks** picker — grouped by category, searchable, multi-select, confirm.
6. The **Dashboard** — your assigned Lifestyle Manager, a stat strip, and your selected
   services as a category-grouped grid. Edit tasks or log out from here.
7. Kill the app and reopen it — you stay logged in.

> The Lifestyle Manager on the dashboard is **mocked client-side** (stable per user, no API
> behind it) and the app says so when you tap it. See `DESIGN.md` for why.

---

## 5. Build the Android APK

```bash
cd mobile
npm install -g eas-cli            # one-time
eas login
eas build -p android --profile preview
```

EAS runs the build in the cloud and gives you an `.apk` download link.
The `preview` profile in `eas.json` is configured for a direct-install APK.

> For local builds without an Expo account, run `npx expo prebuild && cd android && ./gradlew assembleRelease`. Then the APK lives at `android/app/build/outputs/apk/release/app-release.apk`.

**Before building**, point the app at a backend the phone can actually reach — a packaged APK
has no Expo dev server to auto-detect from, and `localhost` means the phone itself. Set
`EXPO_PUBLIC_API_URL` in `mobile/eas.json` (under the `preview` profile) to your deployed API
URL, then build.

---

## 6. Deploy the backend (so the APK works for anyone)

The app in Expo Go talks to your laptop. A **packaged APK needs a backend on the public
internet**, otherwise it only works on your Wi-Fi.

The API runs on SQLite locally (zero setup) and Postgres in production. One schema is the
source of truth: `npm run prod:schema` generates `schema.production.prisma` from it by swapping
only the datasource provider, so the two can't drift.

### 1. Create a free Postgres

[Neon](https://neon.tech) — free, no card. Create a project and copy the connection string
(looks like `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`).

### 2. Get a Brevo API key

A deployed API can't print OTPs to your terminal, so it needs to send real email.
[Brevo](https://www.brevo.com) gives 300 emails/day free and can send to any address.

Take the **API key** (`xkeysib-…`) from **Brevo → SMTP & API → API keys**, and verify your
`MAIL_FROM` address under **Brevo → Senders**.

> **Why the API key and not SMTP?** Render (like most PaaS free tiers) blocks outbound
> connections on SMTP ports 25/465/587 to curb spam — no credential gets around that. Brevo's
> HTTPS API runs on 443, so `MAIL_TRANSPORT=brevo` works where `smtp` cannot. SMTP is still
> the better choice locally, where nothing is blocked.

### 3. Deploy to Render

Push this repo to GitHub, then: **render.com → New → Blueprint → select your repo**.
`render.yaml` configures the service; Render will prompt for the secrets it doesn't store in git:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | your Neon connection string |
| `BREVO_API_KEY` | the `xkeysib-…` API key |
| `MAIL_FROM` | a sender verified in Brevo, e.g. `PadosiPro <you@example.com>` |

> Paste **only the value** into each field — no `KEY=` prefix and no surrounding quotes.
> Those are `.env` file syntax. The start script repairs them and logs a warning, but it's
> there to be noticed rather than relied on.

`JWT_SECRET` is generated by Render automatically. On boot the API pushes the schema, seeds the
catalogue (idempotent), and serves on `/health`.

> Render's free tier sleeps after 15 minutes idle — the first request after that takes ~50s.
> Worth hitting `/health` once before demoing.

### 4. Point the app at it and rebuild

Set `EXPO_PUBLIC_API_URL` in `mobile/eas.json` to `https://your-service.onrender.com`, then
rerun the EAS build.

---

## 7. API surface

Base URL: `http://localhost:4000`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Register, send OTP |
| POST | `/api/auth/verify-email` | — | Verify OTP → returns JWT |
| POST | `/api/auth/resend-otp` | — | Resend code (30s cooldown) |
| POST | `/api/auth/login` | — | Login (verified users) → JWT |
| GET | `/api/profile/me` | Bearer | Current user |
| PUT | `/api/profile/me` | Bearer | Save profile |
| GET | `/api/tasks/catalogue` | — | Categories + tasks |
| GET | `/api/tasks/selections` | Bearer | User's picked tasks |
| PUT | `/api/tasks/selections` | Bearer | Replace user's picks |
| GET | `/health` | — | Liveness |

All error responses use `{ "error": { "code", "message", "details?" } }`.

---

## 8. Repo layout

```
padosipro-assignment/
├─ render.yaml         # Render blueprint for the deployed API
├─ backend/            # Node + Express + Prisma API
│  ├─ docker-compose.yml   # API + Mailpit (optional local path)
│  ├─ Dockerfile
│  ├─ prisma/
│  │  ├─ schema.prisma     # source of truth (sqlite, local)
│  │  └─ seed.ts           # 23 tasks / 5 categories, idempotent
│  ├─ scripts/
│  │  └─ gen-prod-schema.mjs   # derives the postgres schema
│  ├─ src/
│  │  ├─ app.ts  index.ts  config.ts  db.ts  mail.ts
│  │  ├─ middleware/  { auth, error }
│  │  ├─ routes/      { auth, profile, tasks }
│  │  ├─ services/    { otp, token }
│  │  └─ utils/       { hash }
│  └─ tests/          { otp, hash, auth.routes }
└─ mobile/             # Expo React Native app
   ├─ App.tsx
   ├─ app.json
   ├─ eas.json
   ├─ assets/          # icon, adaptive-icon, splash
   └─ src/
      ├─ api/client.ts
      ├─ store/auth.tsx
      ├─ components/ui.tsx
      ├─ screens/     { Register, Verify, Login, Profile, Tasks, Home }
      ├─ navigation/types.ts
      └─ theme/colors.ts
```

See `DESIGN.md` for the architecture, trade-offs, and what I'd tackle next with another week.
