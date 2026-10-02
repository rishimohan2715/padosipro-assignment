import { prisma } from "../db";
import { config } from "../config";
import { generateNumericCode, hashOtp } from "../utils/hash";
import { sendOtpEmail } from "../mail";

export class OtpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function issueOtp(userId: string, email: string) {
  const latest = await prisma.otp.findFirst({
    where: { userId, purpose: "email_verify", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    const since = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (since < config.otp.resendCooldownSeconds) {
      throw new OtpError(
        429,
        "otp_cooldown",
        `Please wait ${Math.ceil(
          config.otp.resendCooldownSeconds - since
        )}s before requesting a new code.`
      );
    }
  }

  // Invalidate prior unconsumed codes so only the newest is valid.
  await prisma.otp.updateMany({
    where: { userId, purpose: "email_verify", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateNumericCode(config.otp.length);
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60_000);

  await prisma.otp.create({
    data: {
      userId,
      codeHash: hashOtp(code),
      expiresAt,
      purpose: "email_verify",
    },
  });

  await sendOtpEmail(email, code, config.otp.ttlMinutes);
  return { expiresAt, resendInSeconds: config.otp.resendCooldownSeconds };
}

export async function verifyOtp(userId: string, code: string) {
  const otp = await prisma.otp.findFirst({
    where: { userId, purpose: "email_verify", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    throw new OtpError(400, "otp_missing", "No active verification code. Request a new one.");
  }
  if (otp.expiresAt.getTime() < Date.now()) {
    throw new OtpError(400, "otp_expired", "Code has expired. Request a new one.");
  }
  if (otp.attempts >= config.otp.maxAttempts) {
    throw new OtpError(
      429,
      "otp_too_many_attempts",
      "Too many wrong attempts. Request a new code."
    );
  }

  const matches = otp.codeHash === hashOtp(code);
  if (!matches) {
    const updated = await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const left = Math.max(0, config.otp.maxAttempts - updated.attempts);
    throw new OtpError(
      400,
      "otp_invalid",
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many wrong attempts. Request a new code."
    );
  }

  await prisma.$transaction([
    prisma.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    }),
  ]);
}
