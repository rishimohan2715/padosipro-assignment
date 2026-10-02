import argon2 from "argon2";
import crypto from "node:crypto";

export const hashPassword = (plain: string) => argon2.hash(plain);
export const verifyPassword = (hash: string, plain: string) =>
  argon2.verify(hash, plain);

// Use HMAC-SHA256 for OTP hashing. Argon2 is overkill for 6-digit codes with
// short TTL and attempt caps; HMAC with a server secret still prevents offline
// brute force if the DB is leaked.
export function hashOtp(code: string): string {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET ?? "dev-secret-change-me")
    .update(code)
    .digest("hex");
}

export function generateNumericCode(length: number): string {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, "0");
}
