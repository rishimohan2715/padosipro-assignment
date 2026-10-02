import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config";

function logOtp(to: string, code: string, ttlMinutes: number) {
  const banner = "═".repeat(52);
  // eslint-disable-next-line no-console
  console.log(
    `\n${banner}\n OTP for ${to}: \x1b[1m${code}\x1b[0m  (valid ${ttlMinutes}m)\n${banner}\n`
  );
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
  // Console mode: no SMTP connection attempted. Default for local dev.
  if (config.mail.transport === "console") {
    logOtp(to, code, ttlMinutes);
    return;
  }

  const isDev = config.nodeEnv !== "production";
  try {
    const info = await getTransporter().sendMail({
      from: config.mail.from,
      to,
      subject: "Your PadosiPro verification code",
      text: `Your PadosiPro verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2 style="color:#0E6B4F;margin:0 0 8px">Welcome to PadosiPro</h2>
          <p style="color:#333">Use the code below to verify your email. It expires in ${ttlMinutes} minutes.</p>
          <div style="font-size:28px;letter-spacing:6px;font-weight:700;background:#F3F8F5;color:#0E6B4F;padding:16px 24px;border-radius:12px;text-align:center;margin:16px 0;">${code}</div>
          <p style="color:#777;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[mail] sent to ${to} (messageId=${info.messageId})`);
    }
  } catch (err) {
    if (!isDev) throw err;
    // eslint-disable-next-line no-console
    console.warn(`[mail] SMTP failed (${(err as Error).message}). Falling back to console.`);
    logOtp(to, code, ttlMinutes);
  }
}
