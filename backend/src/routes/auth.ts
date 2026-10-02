import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../utils/hash";
import { signToken } from "../services/token";
import { issueOtp, verifyOtp } from "../services/otp";
import { HttpError } from "../middleware/error";

const router = Router();

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email.");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

const RegisterBody = z.object({
  email: emailSchema,
  password: passwordSchema,
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = RegisterBody.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      throw new HttpError(409, "email_in_use", "This email is already registered.");
    }

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash: await hashPassword(password) },
        })
      : await prisma.user.create({
          data: { email, passwordHash: await hashPassword(password) },
        });

    const { expiresAt, resendInSeconds } = await issueOtp(user.id, user.email);

    res.status(201).json({
      message: "Registered. Verify your email with the code we sent.",
      email: user.email,
      otpExpiresAt: expiresAt.toISOString(),
      resendInSeconds,
    });
  } catch (err) {
    next(err);
  }
});

const VerifyBody = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{4,8}$/, "Enter the code from your email."),
});

router.post("/verify-email", async (req, res, next) => {
  try {
    const { email, code } = VerifyBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(404, "user_not_found", "No account for this email.");
    if (user.emailVerified) {
      // Idempotent: still issue a token.
      const token = signToken({ sub: user.id, email: user.email });
      return res.json({
        token,
        user: publicUser(user),
      });
    }
    await verifyOtp(user.id, code);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const token = signToken({ sub: fresh.id, email: fresh.email });
    res.json({ token, user: publicUser(fresh) });
  } catch (err) {
    next(err);
  }
});

const ResendBody = z.object({ email: emailSchema });

router.post("/resend-otp", async (req, res, next) => {
  try {
    const { email } = ResendBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(404, "user_not_found", "No account for this email.");
    if (user.emailVerified) {
      throw new HttpError(400, "already_verified", "Email already verified. Please log in.");
    }
    const { expiresAt, resendInSeconds } = await issueOtp(user.id, user.email);
    res.json({
      message: "A new code was sent.",
      otpExpiresAt: expiresAt.toISOString(),
      resendInSeconds,
    });
  } catch (err) {
    next(err);
  }
});

const LoginBody = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = LoginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new HttpError(401, "invalid_credentials", "Invalid email or password.");
    }
    if (!user.emailVerified) {
      // Issue a fresh OTP so the client can send them to the verification screen.
      try {
        await issueOtp(user.id, user.email);
      } catch {
        // Ignore cooldown here; the client just needs to know they're unverified.
      }
      throw new HttpError(403, "email_not_verified", "Please verify your email first.");
    }
    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

type UserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  profileComplete: boolean;
  name: string | null;
  mobile: string | null;
  address: string | null;
  businessName: string | null;
};

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    profileComplete: u.profileComplete,
    profile: {
      name: u.name,
      mobile: u.mobile,
      address: u.address,
      businessName: u.businessName,
    },
  };
}

export { publicUser };
export default router;
