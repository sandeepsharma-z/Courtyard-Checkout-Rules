import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

const datasourceUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_POSTGRES_URL_NON_POOLING;

const createPrismaClient = () =>
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

export async function ensureRuntimeDatabase() {
  return;
}

export default prisma;
