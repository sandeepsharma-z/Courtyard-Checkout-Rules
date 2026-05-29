import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const fallbackKeys = [
  "DATABASE_POSTGRES_PRISMA_URL",
  "DATABASE_POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_POSTGRES_URL_NON_POOLING",
];

const prismaArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--require-url");

const isMigrationCommand =
  prismaArgs[0] === "migrate" || prismaArgs.includes("migrate");

if (isMigrationCommand) {
  // Prefer an explicit unpooled/direct URL env var if available
  const migrationUrlKey = fallbackKeys.find((key) => process.env[key]);
  if (migrationUrlKey) {
    process.env.DATABASE_URL = process.env[migrationUrlKey];
  }

  // If still using a Neon pooled URL, auto-convert to direct connection.
  // Neon pooled: ep-xxx-pooler.region.aws.neon.tech
  // Neon direct: ep-xxx.region.aws.neon.tech
  // Advisory locks require a direct (non-PgBouncer) connection.
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("-pooler.")) {
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
}

if (!process.env.DATABASE_URL) {
  const fallbackKey = fallbackKeys.find((key) => process.env[key]);

  if (fallbackKey) {
    process.env.DATABASE_URL = process.env[fallbackKey];
  }
}

if (!process.env.DATABASE_URL && process.argv.includes("--require-url")) {
  console.error(
    "DATABASE_URL is missing. Set DATABASE_URL or a Neon fallback variable before running Prisma.",
  );
  process.exit(1);
}

const prismaBinary = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const command = existsSync(prismaBinary)
  ? prismaBinary
  : process.platform === "win32"
    ? "npx.cmd"
    : "npx";
const args = existsSync(prismaBinary) ? prismaArgs : ["prisma", ...prismaArgs];

const result = spawnSync(command, args, {
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
