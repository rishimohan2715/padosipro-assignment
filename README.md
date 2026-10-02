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

The default (`mobile/app.json → expo.extra.apiBaseUrl`) works for the Android emulator.
Override for a physical device by editing `app.json`:

```json
"extra": { "apiBaseUrl": "http://192.168.1.42:4000" }
```

Use the dev machine's LAN IP. Restart `expo start` after changing it.

### Run the tests

```bash
npm test            # from the repo root
```

Covers OTP generation, expiry, resend cooldown, attempt limits, and password hashing.

---

## 4. The full flow (how to try it)

1. Open the app → **Register** with any email + password (min 8 chars).
2. Look at the **backend terminal** — the 6-digit OTP is printed in a highlighted banner. (If you flipped `MAIL_TRANSPORT=smtp` + Mailpit, open **http://localhost:8025** instead.)
3. Enter the code in the **Verify** screen. On success you're logged in.
4. First-time users see the **Profile** screen (Name, +91 mobile, Address, optional Business Name).
5. Then the **Tasks** picker — grouped by category, searchable, multi-select, confirm.
6. **Home** screen lists your selected tasks. Edit from here or log out.
7. Kill the app and reopen it — you stay logged in.

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

Before building, bake the production API URL into `app.json → expo.extra.apiBaseUrl` so the installed app can reach your backend (localhost won't work on a phone).

---

## 6. API surface

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

## 7. Repo layout

```
padosipro-assignment/
├─ backend/            # Node + Express + Prisma API
│  ├─ docker-compose.yml
│  ├─ Dockerfile
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ seed.ts
│  ├─ src/
│  │  ├─ app.ts  index.ts  config.ts  db.ts  mail.ts
│  │  ├─ middleware/  { auth, error }
│  │  ├─ routes/      { auth, profile, tasks }
│  │  ├─ services/    { otp, token }
│  │  └─ utils/       { hash }
│  └─ tests/          { otp, hash }
└─ mobile/             # Expo React Native app
   ├─ App.tsx
   ├─ app.json
   ├─ eas.json
   └─ src/
      ├─ api/client.ts
      ├─ store/auth.tsx
      ├─ components/ui.tsx
      ├─ screens/     { Register, Verify, Login, Profile, Tasks, Home }
      ├─ navigation/types.ts
      └─ theme/colors.ts
```

See `DESIGN.md` for the architecture, trade-offs, and what I'd tackle next with another week.
