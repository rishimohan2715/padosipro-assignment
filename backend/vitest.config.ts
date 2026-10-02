import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/globalSetup.ts"],
    // Integration tests share one SQLite file, so run files serially.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret",
      MAIL_TRANSPORT: "console",
      OTP_LENGTH: "6",
      OTP_TTL_MINUTES: "10",
      OTP_MAX_ATTEMPTS: "5",
      OTP_RESEND_COOLDOWN_SECONDS: "30",
    },
  },
});
