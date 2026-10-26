import { prisma, dbError } from "@/lib/prisma";
import { MODELS } from "@/lib/lumi";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const chat = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });
    return Response.json(chat);
  } catch (e) {
    return dbError(e);
  }
}

const clamp = (n: unknown) => Math.min(1, Math.max(0, Math.round(Number(n) * 10) / 10));

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.model === "string" && (MODELS as readonly string[]).includes(body.model)) data.model = body.model;
    if (body.promptId === null || typeof body.promptId === "string") data.promptId = body.promptId;
    if (body.temperature !== undefined && !Number.isNaN(Number(body.temperature))) data.temperature = clamp(body.temperature);
    if (body.topP !== undefined && !Number.isNaN(Number(body.topP))) data.topP = clamp(body.topP);
    if (body.clearMessages === true) {
      await prisma.message.deleteMany({ where: { sessionId: id } });
      data.title = "New chat";
    }
    const chat = await prisma.chatSession.update({ where: { id }, data });
    return Response.json(chat);
  } catch (e) {
    return dbError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.chatSession.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return dbError(e);
  }
}
