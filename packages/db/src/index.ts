import { PrismaClient } from "@prisma/client";

// Standard Next.js dev pattern: reuse one client across hot reloads instead
// of opening a fresh pool of Postgres connections on every module reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
