import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const DB_FILE = path.join(__dirname, "..", "prisma", "test.db");

export async function setup() {
  rmSync(DB_FILE, { force: true });
  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "ignore",
  });
}

export async function teardown() {
  rmSync(DB_FILE, { force: true });
}
