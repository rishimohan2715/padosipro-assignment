import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config";
import { HttpError } from "./middleware/error";

/**
 * A delivery failure the operator needs to act on. Carries a reason the client
 * can see — the host and failure class, never the credentials — because
 * otherwise this surfaces as an opaque 500 on the one route it breaks.
 */
export class MailError extends HttpError {
  constructor(cause: Error, host: string, port: number) {
    const m = cause.message.toLowerCase();
    const reason =
      m.includes("auth") || m.includes("535") || m.includes("credential")
        ? "SMTP credentials were rejected"
        : m.includes("econnrefused") || m.includes("enotfound") || m.includes("timeout")
        ? `could not reach ${host}:${port}`
        : m.includes("sender") || m.includes("from")
        ? "the sender address is not accepted by the mail provider"
        : "the mail server rejected the message";
    super(502, "mail_send_failed", `Could not send the verification email: ${reason}.`);
  }
}

function logOtp(to: string, code: string, ttlMinutes: number) {
  const banner = "═".repeat(52);
  // eslint-disable-next-line no-console
  console.log(
    `\n${banner}\n OTP for ${to}: \x1b[1m${code}\x1b[0m  (valid ${ttlMinutes}m)\n${banner}\n`
  );
}

/** Splits `Name <addr@host>` into Brevo's sender object. */
function parseFrom(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
}

/**
 * Brevo over HTTPS. Many PaaS hosts (Render's free tier among them) block
 * outbound SMTP ports to curb spam, which no credential can work around — so
 * the same provider is reachable on 443 or not at all.
 */
async function sendViaBrevoApi(subject: string, to: string, html: string, text: string) {
  const key = config.mail.brevoApiKey;
  if (!key) {
    throw new HttpError(
      500,
      "mail_not_configured",
      "MAIL_TRANSPORT=brevo requires BREVO_API_KEY (the xkeysib-… API key)."
    );
  }

  let res: Response;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: parseFrom(config.mail.from),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new HttpError(
      502,
      "mail_send_failed",
      `Could not send the verification email: could not reach the Brevo API (${
        (err as Error).message
      }).`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error(`[mail] Brevo API ${res.status}: ${body.slice(0, 300)}`);
    const reason =
      res.status === 401
        ? "the Brevo API key was rejected"
        : res.status === 400 && /sender/i.test(body)
        ? `the sender ${parseFrom(config.mail.from).email} is not verified in Brevo`
        : `Brevo returned ${res.status}`;
    throw new HttpError(502, "mail_send_failed", `Could not send the verification email: ${reason}.`);
  }
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      connectionTimeout: 2000,
      greetingTimeout: 2000,
      socketTimeout: 3000,
      auth:
        config.smtp.user && config.smtp.pass
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
    });
  }
  return transporter;
}

export async function sendOtpEmail(to: string, code: string, ttlMinutes: number) {
  // Console mode: nothing is sent. Default for local dev.
  if (config.mail.transport === "console") {
    logOtp(to, code, ttlMinutes);
    return;
  }

  const subject = "Your PadosiPro verification code";
  const text = `Your PadosiPro verification code is ${code}. It expires in ${ttlMinutes} minutes.`;
  const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2 style="color:#0E6B4F;margin:0 0 8px">Welcome to PadosiPro</h2>
          <p style="color:#333">Use the code below to verify your email. It expires in ${ttlMinutes} minutes.</p>
          <div style="font-size:28px;letter-spacing:6px;font-weight:700;background:#F3F8F5;color:#0E6B4F;padding:16px 24px;border-radius:12px;text-align:center;margin:16px 0;">${code}</div>
          <p style="color:#777;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
      `;

  const isDev = config.nodeEnv !== "production";

  if (config.mail.transport === "brevo") {
    await sendViaBrevoApi(subject, to, html, text);
    // eslint-disable-next-line no-console
    console.log(`[mail] sent to ${to} via Brevo API`);
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from: config.mail.from,
      to,
      subject,
      text,
      html,
    });
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[mail] sent to ${to} (messageId=${info.messageId})`);
    }
  } catch (err) {
    if (!isDev) {
      // eslint-disable-next-line no-console
      console.error(
        `[mail] send failed via ${config.smtp.host}:${config.smtp.port} ` +
          `as ${config.smtp.user ?? "(no user)"} — ${(err as Error).message}`
      );
      throw new MailError(err as Error, config.smtp.host, config.smtp.port);
    }
    // eslint-disable-next-line no-console
    console.warn(`[mail] SMTP failed (${(err as Error).message}). Falling back to console.`);
    logOtp(to, code, ttlMinutes);
  }
}
