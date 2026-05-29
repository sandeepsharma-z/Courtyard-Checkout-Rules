/**
 * Sets up the correct DATABASE_URL for Neon migrations, then runs
 * prisma migrate deploy with retry logic.
 *
 * Neon serverless cold starts cause advisory lock timeouts (P1002).
 * Retrying after a short delay gives the instance time to wake up.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// ── URL setup (same logic as prisma-with-database-url.mjs) ──────────────────

const fallbackKeys = [
  "DATABASE_POSTGRES_PRISMA_URL",
  "DATABASE_POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_POSTGRES_URL_NON_POOLING",
];

// Prefer an explicit unpooled/direct URL env var if available
const migrationUrlKey = fallbackKeys.find((key) => process.env[key]);
if (migrationUrlKey) {
  process.env.DATABASE_URL = process.env[migrationUrlKey];
}

// If still using a Neon pooled URL, auto-convert to direct connection.
// Advisory locks require a direct (non-PgBouncer) connection.
if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL
    .replace(/-pooler\./g, ".")
    .replace(/[?&]pgbouncer=true/g, "");
}

// Ensure adequate timeouts for Neon serverless cold starts
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "60");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "60");
  process.env.DATABASE_URL = url.toString();
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Cannot run migrations.");
  process.exit(1);
}

// ── Retry logic ──────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 10000;

const prismaBinary = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const command = existsSync(prismaBinary) ? prismaBinary : "npx";
const args = existsSync(prismaBinary)
  ? ["migrate", "deploy"]
  : ["prisma", "migrate", "deploy"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      console.log(`\nRetrying migration (attempt ${attempt}/${MAX_ATTEMPTS}) after ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
    }

    const result = spawnSync(command, args, {
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    if (result.status === 0) {
      process.exit(0);
    }

    const output = result.output?.join("") ?? "";
    const isLockTimeout = output.includes("P1002") || output.includes("advisory lock");

    if (!isLockTimeout || attempt === MAX_ATTEMPTS) {
      console.error(`Migration failed after ${attempt} attempt(s).`);
      process.exit(result.status ?? 1);
    }

    console.warn("Migration timed out (Neon advisory lock). Will retry...");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
