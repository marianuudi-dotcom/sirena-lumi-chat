import { prisma, dbError } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const chats = await prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    return Response.json(chats);
  } catch (e) {
    return dbError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const chat = await prisma.chatSession.create({
      data: {
        model: typeof body.model === "string" ? body.model : undefined,
        promptId: typeof body.promptId === "string" ? body.promptId : undefined,
      },
    });
    return Response.json(chat, { status: 201 });
  } catch (e) {
    return dbError(e);
  }
}
