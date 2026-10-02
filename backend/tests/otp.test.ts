import { describe, it, expect, beforeEach, vi } from "vitest";

process.env.JWT_SECRET = "test-secret";
process.env.OTP_RESEND_COOLDOWN_SECONDS = "30";
process.env.OTP_MAX_ATTEMPTS = "5";
process.env.OTP_TTL_MINUTES = "10";
process.env.OTP_LENGTH = "6";

// In-memory fake prisma store so we can exercise OTP service without a DB.
type OtpRow = {
  id: string;
  userId: string;
  codeHash: string;
  purpose: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
};
const store = {
  otps: [] as OtpRow[],
  users: [] as { id: string; email: string; emailVerified: boolean }[],
};
let idCounter = 1;

vi.mock("../src/db", () => ({
  prisma: {
    otp: {
      findFirst: async ({ where, orderBy }: any) => {
        let rows = store.otps.filter((o) =>
          Object.entries(where).every(([k, v]) =>
            v === null ? (o as any)[k] === null : (o as any)[k] === v
          )
        );
        if (orderBy?.createdAt === "desc") {
          rows = rows.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return rows[0] ?? null;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const o of store.otps) {
          const match = Object.entries(where).every(([k, v]) =>
            v === null ? (o as any)[k] === null : (o as any)[k] === v
          );
          if (match) {
            Object.assign(o, data);
            count++;
          }
        }
        return { count };
      },
      create: async ({ data }: any) => {
        const row: OtpRow = {
          id: String(idCounter++),
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
          purpose: "email_verify",
          ...data,
        };
        store.otps.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = store.otps.find((o) => o.id === where.id);
        if (!row) throw new Error("not found");
        if (data.attempts?.increment) row.attempts += data.attempts.increment;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return row;
      },
    },
    user: {
      update: async ({ where, data }: any) => {
        const u = store.users.find((x) => x.id === where.id);
        if (!u) throw new Error("not found");
        Object.assign(u, data);
        return u;
      },
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  },
}));

vi.mock("../src/mail", () => ({
  sendOtpEmail: vi.fn(async () => undefined),
}));

import { issueOtp, verifyOtp, OtpError } from "../src/services/otp";
import { hashOtp } from "../src/utils/hash";

beforeEach(() => {
  store.otps = [];
  store.users = [{ id: "u1", email: "test@example.com", emailVerified: false }];
  idCounter = 1;
});

describe("OTP service", () => {
  it("issues a 6-digit code that expires in ~10 minutes", async () => {
    const before = Date.now();
    const { expiresAt } = await issueOtp("u1", "test@example.com");
    expect(store.otps).toHaveLength(1);
    expect(expiresAt.getTime() - before).toBeGreaterThan(9 * 60_000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(10 * 60_000 + 500);
    expect(store.otps[0].codeHash).not.toMatch(/^\d{6}$/); // hashed, not plain
  });

  it("rejects a resend within the cooldown", async () => {
    await issueOtp("u1", "test@example.com");
    await expect(issueOtp("u1", "test@example.com")).rejects.toBeInstanceOf(OtpError);
  });

  it("allows resend after cooldown and invalidates the previous code", async () => {
    await issueOtp("u1", "test@example.com");
    const first = store.otps[0];
    first.createdAt = new Date(Date.now() - 31_000);
    await issueOtp("u1", "test@example.com");
    expect(store.otps).toHaveLength(2);
    const stillActive = store.otps.filter((o) => o.consumedAt === null);
    expect(stillActive).toHaveLength(1);
  });

  it("verifies a correct code and marks the user verified", async () => {
    await issueOtp("u1", "test@example.com");
    // Figure out the plain code via brute force (test-only shortcut).
    const hash = store.otps[0].codeHash;
    let plain = "";
    for (let i = 0; i < 1_000_000; i++) {
      const c = i.toString().padStart(6, "0");
      if (hashOtp(c) === hash) {
        plain = c;
        break;
      }
    }
    expect(plain).toMatch(/^\d{6}$/);
    await verifyOtp("u1", plain);
    expect(store.otps[0].consumedAt).toBeInstanceOf(Date);
    expect(store.users[0].emailVerified).toBe(true);
  });

  it("rejects an incorrect code and bumps the attempt counter", async () => {
    await issueOtp("u1", "test@example.com");
    await expect(verifyOtp("u1", "000000")).rejects.toBeInstanceOf(OtpError);
    expect(store.otps[0].attempts).toBe(1);
  });

  it("locks after max attempts", async () => {
    await issueOtp("u1", "test@example.com");
    for (let i = 0; i < 5; i++) {
      await verifyOtp("u1", "999999").catch(() => undefined);
    }
    await expect(verifyOtp("u1", "999999")).rejects.toMatchObject({
      code: "otp_too_many_attempts",
    });
  });

  it("rejects expired codes", async () => {
    await issueOtp("u1", "test@example.com");
    store.otps[0].expiresAt = new Date(Date.now() - 1000);
    await expect(verifyOtp("u1", "123456")).rejects.toMatchObject({
      code: "otp_expired",
    });
  });

  it("rejects when no active code exists", async () => {
    await expect(verifyOtp("u1", "123456")).rejects.toMatchObject({
      code: "otp_missing",
    });
  });
});
