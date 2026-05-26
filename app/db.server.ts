import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
  // eslint-disable-next-line no-var
  var prismaRuntimeDatabaseReady: Promise<void> | undefined;
}

const datasourceUrl =
  process.env.DATABASE_URL ??
  (process.env.VERCEL ? "file:/tmp/courtyard-checkout-rules.sqlite" : undefined);

const createPrismaClient = () =>
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

export async function ensureRuntimeDatabase() {
  if (!process.env.VERCEL) {
    return;
  }

  if (!global.prismaRuntimeDatabaseReady) {
    global.prismaRuntimeDatabaseReady = bootstrapSqliteRuntimeDatabase();
  }

  await global.prismaRuntimeDatabaseReady;
}

async function bootstrapSqliteRuntimeDatabase() {
  const existingTables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Session'",
  );

  if (existingTables.length > 0) {
    return;
  }

  const migrationsPath = path.join(process.cwd(), "prisma", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsPath, entry.name, "migration.sql"))
    .filter((filePath) => fs.existsSync(filePath))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sql = fs.readFileSync(migrationFile, "utf8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}

export default prisma;
