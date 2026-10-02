import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

// Capture OTPs as they're issued instead of reading the hashed row back.
const sent: { to: string; code: string }[] = [];
vi.mock("../src/mail", () => ({
  sendOtpEmail: vi.fn(async (to: string, code: string) => {
    sent.push({ to, code });
  }),
}));

import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();

/** Register + verify a user, returning their JWT. */
async function registerVerified(email: string, password = "testpass123") {
  await request(app).post("/api/auth/register").send({ email, password }).expect(201);
  const code = sent.at(-1)!.code;
  const res = await request(app)
    .post("/api/auth/verify-email")
    .send({ email, code })
    .expect(200);
  return res.body.token as string;
}

beforeEach(async () => {
  sent.length = 0;
  await prisma.userTask.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/auth/register", () => {
  it("creates a user, stores no plaintext password, and emails a 6-digit code", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "New@Example.com", password: "testpass123" })
      .expect(201);

    expect(res.body.email).toBe("new@example.com"); // normalised
    expect(sent).toHaveLength(1);
    expect(sent[0].code).toMatch(/^\d{6}$/);

    const user = await prisma.user.findUnique({ where: { email: "new@example.com" } });
    expect(user!.passwordHash).not.toContain("testpass123");
    expect(user!.passwordHash.startsWith("$argon2")).toBe(true);
    expect(user!.emailVerified).toBe(false);
  });

  it("rejects a short password and a malformed email", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "short" })
      .expect(400);
    await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "testpass123" })
      .expect(400);
  });

  it("refuses to re-register an already-verified email", async () => {
    await registerVerified("taken@example.com");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "taken@example.com", password: "testpass123" })
      .expect(409);
    expect(res.body.error.code).toBe("email_in_use");
  });
});

describe("login rules", () => {
  it("rejects an unverified user with email_not_verified, not a token", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "unverified@example.com", password: "testpass123" })
      .expect(201);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com", password: "testpass123" })
      .expect(403);

    expect(res.body.error.code).toBe("email_not_verified");
    expect(res.body.token).toBeUndefined();
  });

  it("issues a token once the email is verified", async () => {
    await registerVerified("verified@example.com");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "verified@example.com", password: "testpass123" })
      .expect(200);

    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a wrong password", async () => {
    await registerVerified("pw@example.com");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "pw@example.com", password: "wrongpassword" })
      .expect(401);
    expect(res.body.error.code).toBe("invalid_credentials");
  });

  it("gives the same error for an unknown email as for a wrong password", async () => {
    await registerVerified("known@example.com");
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "testpass123" })
      .expect(401);
    const wrongPw = await request(app)
      .post("/api/auth/login")
      .send({ email: "known@example.com", password: "wrongpassword" })
      .expect(401);

    // Identical responses, so login can't be used to enumerate accounts.
    expect(unknown.body.error.code).toBe(wrongPw.body.error.code);
    expect(unknown.body.error.message).toBe(wrongPw.body.error.message);
  });

  it("is case-insensitive on the email", async () => {
    await registerVerified("mixed@example.com");
    await request(app)
      .post("/api/auth/login")
      .send({ email: "MiXeD@Example.COM", password: "testpass123" })
      .expect(200);
  });
});

describe("OTP route behaviour", () => {
  it("rejects a wrong code, then accepts the right one", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "otp@example.com", password: "testpass123" })
      .expect(201);
    const code = sent.at(-1)!.code;
    const wrong = code === "000000" ? "111111" : "000000";

    const bad = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "otp@example.com", code: wrong })
      .expect(400);
    expect(bad.body.error.code).toBe("otp_invalid");

    await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "otp@example.com", code })
      .expect(200);
  });

  it("burns the code after a successful verification (single use)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "single@example.com", password: "testpass123" })
      .expect(201);
    const code = sent.at(-1)!.code;

    await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "single@example.com", code })
      .expect(200);

    const active = await prisma.otp.findMany({
      where: { consumedAt: null, user: { email: "single@example.com" } },
    });
    expect(active).toHaveLength(0);
  });

  it("enforces the resend cooldown", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "cooldown@example.com", password: "testpass123" })
      .expect(201);

    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "cooldown@example.com" })
      .expect(429);
    expect(res.body.error.code).toBe("otp_cooldown");
  });

  it("locks the code after 5 wrong attempts", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "lock@example.com", password: "testpass123" })
      .expect(201);
    const code = sent.at(-1)!.code;
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/auth/verify-email")
        .send({ email: "lock@example.com", code: wrong });
    }

    // Even the correct code is refused once the attempt cap is hit.
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "lock@example.com", code })
      .expect(429);
    expect(res.body.error.code).toBe("otp_too_many_attempts");
  });
});

describe("protected routes", () => {
  it("rejects requests with no or a bad bearer token", async () => {
    await request(app).get("/api/profile/me").expect(401);
    await request(app)
      .get("/api/profile/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("validates the Indian mobile number on profile save", async () => {
    const token = await registerVerified("profile@example.com");
    const bad = await request(app)
      .put("/api/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test User", mobile: "9876543210", address: "12 Test Street, Mumbai" })
      .expect(400);
    expect(bad.body.error.code).toBe("validation_error");

    const ok = await request(app)
      .put("/api/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test User", mobile: "+919876543210", address: "12 Test Street, Mumbai" })
      .expect(200);
    expect(ok.body.user.profileComplete).toBe(true);
    expect(ok.body.user.profile.businessName).toBeNull(); // optional field
  });
});
