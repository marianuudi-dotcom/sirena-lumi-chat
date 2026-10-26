import { prisma, dbError } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await prisma.systemPrompt.findMany({ orderBy: { createdAt: "asc" } }));
  } catch (e) {
    return dbError(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!name || !content) return Response.json({ error: "Name and prompt text are required." }, { status: 400 });
  try {
    return Response.json(await prisma.systemPrompt.create({ data: { name, content } }), { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return Response.json({ error: "A persona with this name already exists." }, { status: 409 });
    return dbError(e);
  }
}
