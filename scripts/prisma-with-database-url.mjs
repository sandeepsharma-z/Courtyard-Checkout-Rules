import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const fallbackKeys = [
  "DATABASE_POSTGRES_PRISMA_URL",
  "DATABASE_POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_POSTGRES_URL_NON_POOLING",
];

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

const prismaArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--require-url");

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
