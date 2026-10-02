import "dotenv/config";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: int("PORT", 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  otp: {
    length: int("OTP_LENGTH", 6),
    ttlMinutes: int("OTP_TTL_MINUTES", 10),
    maxAttempts: int("OTP_MAX_ATTEMPTS", 5),
    resendCooldownSeconds: int("OTP_RESEND_COOLDOWN_SECONDS", 30),
  },
  mail: {
    transport: (process.env.MAIL_TRANSPORT ?? "console").toLowerCase() as
      | "console"
      | "smtp"
      | "brevo",
    from: process.env.MAIL_FROM ?? "PadosiPro <no-reply@padosipro.local>",
    brevoApiKey: process.env.BREVO_API_KEY || undefined,
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "localhost",
    port: int("SMTP_PORT", 1025),
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
  },
};
