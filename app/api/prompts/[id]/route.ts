import { prisma, dbError } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!name || !content) return Response.json({ error: "Name and prompt text are required." }, { status: 400 });
  try {
    return Response.json(await prisma.systemPrompt.update({ where: { id }, data: { name, content } }));
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return Response.json({ error: "A persona with this name already exists." }, { status: 409 });
    return dbError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.systemPrompt.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return dbError(e);
  }
}
