import { prisma, dbError } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await prisma.tip.count();
    const tip = count ? await prisma.tip.findFirst({ skip: Math.floor(Math.random() * count) }) : null;
    const starters = await prisma.knowledgeEntry.findMany({ where: { id: { in: ["KB01", "KB10", "KB08", "KB18"] } } });
    return Response.json({ tip: tip?.text ?? null, starters: starters.map((s) => s.question) });
  } catch (e) {
    return dbError(e);
  }
}
