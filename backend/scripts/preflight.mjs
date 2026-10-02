// Validates DATABASE_URL before Prisma runs, so a misconfigured env var fails
// with an actionable message instead of Prisma's generic P1012.
// Never prints the credential itself — only its shape.
const raw = process.env.DATABASE_URL;

function fail(problem, fix) {
  console.error(`\n✗ DATABASE_URL ${problem}\n`);
  console.error(`  ${fix}\n`);
  process.exit(1);
}

if (raw === undefined) {
  fail(
    "is not set.",
    "Add it in Render → Environment. Get the value from your Neon dashboard."
  );
}

if (raw.trim() === "") {
  fail("is empty.", "Paste the Neon connection string in Render → Environment.");
}

// Report the shape so a bad value is obvious from the deploy log.
const firstChar = raw[0];
const scheme = raw.slice(0, Math.max(0, raw.indexOf("://") + 3)) || "(no :// found)";
console.log(
  `[preflight] DATABASE_URL: ${raw.length} chars, starts with ${JSON.stringify(
    raw.slice(0, 2)
  )}, scheme ${JSON.stringify(scheme)}`
);

// Checked before whitespace: pasting a whole `KEY=value` line usually drags a
// newline along too, and the name prefix is the more useful thing to report.
const named = raw.trim().match(/^([A-Z_][A-Z0-9_]*)=/);
if (named) {
  fail(
    `includes the variable name: the value starts with "${named[1]}=".`,
    "That prefix is .env file syntax. In a dashboard the name goes in the key field — " +
      "paste only the part after the '=', starting at postgresql://"
  );
}

if (raw !== raw.trim()) {
  fail(
    "has leading or trailing whitespace.",
    "Re-paste it with no stray spaces or newlines."
  );
}

if (firstChar === '"' || firstChar === "'") {
  fail(
    `is wrapped in ${firstChar === '"' ? "double" : "single"} quotes.`,
    "Quotes are .env file syntax, not part of the value. Paste it without them."
  );
}

if (/^psql\b/i.test(raw)) {
  fail(
    "is a psql command, not a connection string.",
    "In Neon, switch the snippet dropdown from 'psql' to a plain connection string — " +
      "the value must begin with postgresql://"
  );
}

if (!/^postgres(ql)?:\/\//.test(raw)) {
  fail(
    `starts with ${JSON.stringify(raw.slice(0, 12))}, which is not a Postgres URL.`,
    "It must begin with postgresql:// — copy the connection string from Neon."
  );
}

console.log("[preflight] DATABASE_URL looks valid.\n");
