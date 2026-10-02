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

for (const key of ["DATABASE_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) {
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
