import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function dbError(e: unknown) {
  console.error("[db]", e);
  return Response.json(
    { error: "Lumi cannot reach the database right now. Please try again in a moment." },
    { status: 503 }
  );
}
