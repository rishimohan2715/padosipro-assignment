// Production entrypoint: normalise the environment, then push the schema, seed,
// and serve. Running these as children of one process (instead of a shell &&
// chain) lets the repairs below apply to every step.
import { spawnSync } from "node:child_process";

// Pasting into a dashboard field is lossy in predictable ways: people bring the
// `KEY=` prefix, the quotes that .env syntax requires, or a trailing newline.
// None of those are ambiguous, so repair them and say so rather than failing a
// deploy over a copy-paste artefact.
function normalise(name) {
  const original = process.env[name];
  if (typeof original !== "string") return;

  let v = original.trim();
  const repairs = [];

  if (v.startsWith(`${name}=`)) {
    v = v.slice(name.length + 1).trim();
    repairs.push(`removed the "${name}=" prefix`);
  }
  if (v.length > 1 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    v = v.slice(1, -1).trim();
    repairs.push("removed surrounding quotes");
  }
  if (v !== original.trim()) {
    // nothing extra
  }
  if (original !== v) {
    if (original.trim() !== original) repairs.push("trimmed whitespace");
    process.env[name] = v;
    console.warn(
      `[start] ${name} needed cleanup (${repairs.join(", ")}). ` +
        `Fix it at the source so this isn't relied on.`
    );
  }
}

for (const key of [
  "DATABASE_URL",
  "BREVO_API_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM",
]) {
  normalise(key);
}

const url = process.env.DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error(
    `\n✗ DATABASE_URL is not a Postgres connection string.\n` +
      `  Got ${url ? `${url.length} chars starting ${JSON.stringify(url.slice(0, 12))}` : "nothing"}.\n` +
      `  Set it in Render → Environment to the value from Neon, starting with postgresql://\n`
  );
  process.exit(1);
}
console.log(`[start] DATABASE_URL ok (${url.length} chars, ${url.split("://")[0]}://…)`);

// A deployed API that can't send OTPs can't register anyone, and the failure
// would otherwise surface as a 500 on a user's first signup. Missing config is
// deterministic, so fail now; a flaky mail host is not, so that only warns.
const transport = (process.env.MAIL_TRANSPORT ?? "console").toLowerCase();

if (transport === "brevo") {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error(
      `\n✗ MAIL_TRANSPORT=brevo but BREVO_API_KEY is not set.\n` +
        `  Use the API key (xkeysib-…) from Brevo → SMTP & API → API keys.\n`
    );
    process.exit(1);
  }
  // Brevo issues two keys and they are easy to mix up. The SMTP one authenticates
  // the relay, not the REST API, so it would 401 on every send.
  if (key.startsWith("xsmtpsib-")) {
    console.error(
      `\n✗ BREVO_API_KEY is an SMTP key (xsmtpsib-…), not an API key.\n` +
        `  The HTTPS API needs the key from Brevo → SMTP & API → "API keys" tab,\n` +
        `  which starts with xkeysib-. The SMTP tab's key only works for port 587.\n`
    );
    process.exit(1);
  }
  if (!key.startsWith("xkeysib-")) {
    console.warn(
      `[start] BREVO_API_KEY does not start with "xkeysib-" — if sends 401, that is why.`
    );
  }
  console.log(`[start] mail: Brevo HTTPS API (key ${key.slice(0, 9)}…, ${key.length} chars)`);
} else if (transport === "smtp") {
  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((k) => !process.env[k]);
  const host = process.env.SMTP_HOST ?? "";
  if (missing.length || host === "localhost" || host === "127.0.0.1") {
    console.error(
      `\n✗ MAIL_TRANSPORT=smtp but the SMTP settings are not usable.\n` +
        (missing.length ? `  Missing: ${missing.join(", ")}\n` : "") +
        (host === "localhost" || host === "127.0.0.1"
          ? `  SMTP_HOST is "${host}", which is this container, not a mail server.\n`
          : "") +
        `  Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in Render → Environment.\n` +
        `  With Brevo, SMTP_PASS is the SMTP key (xsmtpsib-…), not the API key.\n`
    );
    process.exit(1);
  }
  console.log(`[start] SMTP configured (${host}:${process.env.SMTP_PORT ?? 587})`);
}

function run(label, cmd, args) {
  console.log(`\n[start] ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: false });
  if (r.status !== 0) {
    console.error(`[start] ${label} failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

run("applying schema", "npx", [
  "prisma",
  "db",
  "push",
  "--schema",
  "prisma/schema.production.prisma",
  "--skip-generate",
]);
run("seeding catalogue", "npx", ["tsx", "prisma/seed.ts"]);

console.log("\n[start] starting server");
await import("../dist/index.js");
