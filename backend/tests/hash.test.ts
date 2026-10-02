import { describe, it, expect } from "vitest";
import { generateNumericCode, hashOtp, hashPassword, verifyPassword } from "../src/utils/hash";

describe("hash utilities", () => {
  it("generates numeric codes of exact length", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateNumericCode(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("produces a stable hash for the same code", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
    expect(hashOtp("123456")).not.toBe(hashOtp("123457"));
  });

  it("hashes passwords with argon2 (verifiable, not reversible)", async () => {
    const hash = await hashPassword("hunter2hunter2");
    expect(hash).toMatch(/^\$argon2/);
    expect(await verifyPassword(hash, "hunter2hunter2")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});
