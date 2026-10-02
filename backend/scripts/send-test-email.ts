// Sends one test email through the exact code path the API uses, so SMTP
// problems surface here instead of halfway through a deploy.
//
//   npx tsx scripts/send-test-email.ts you@example.com
import "dotenv/config";
import { config } from "../src/config";
import { sendOtpEmail } from "../src/mail";

const to = process.argv[2];

if (!to) {
  console.error("Usage: npx tsx scripts/send-test-email.ts <recipient@example.com>");
  process.exit(1);
}

console.log(`transport : ${config.mail.transport}`);
console.log(`from      : ${config.mail.from}`);
console.log(`host      : ${config.smtp.host}:${config.smtp.port}`);
console.log(`user      : ${config.smtp.user ?? "(none)"}`);
console.log(`pass      : ${config.smtp.pass ? "set" : "(none)"}`);
console.log(`to        : ${to}\n`);

if (config.mail.transport !== "smtp") {
  console.error(
    `MAIL_TRANSPORT is "${config.mail.transport}", so this would only print to the console.\n` +
      `Set MAIL_TRANSPORT=smtp in backend/.env to actually send.`
  );
  process.exit(1);
}

// In production mode a send failure throws instead of falling back to the
// console — which is what we want to surface here.
process.env.NODE_ENV = "production";

sendOtpEmail(to, "123456", 10)
  .then(() => console.log("\n✓ Sent. Check the inbox (and the spam folder)."))
  .catch((err: Error) => {
    console.error(`\n✗ Failed: ${err.message}\n`);
    const m = err.message.toLowerCase();
    if (m.includes("auth") || m.includes("535") || m.includes("credential")) {
      console.error(
        "Authentication failed. With Brevo this is almost always the wrong key:\n" +
          "  SMTP_PASS must be the SMTP key (xsmtpsib-…), not the API key (xkeysib-…).\n" +
          "  SMTP_USER is the SMTP login shown in Brevo → SMTP & API → SMTP,\n" +
          "  which looks like 9a1b2c@smtp-brevo.com — not your account email."
      );
    } else if (m.includes("timeout") || m.includes("econnrefused") || m.includes("enotfound")) {
      console.error("Could not reach the server. Check SMTP_HOST and SMTP_PORT.");
    }
    process.exit(1);
  });
