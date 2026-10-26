import { prisma, dbError } from "@/lib/prisma";
import { answer } from "@/lib/lumi";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const attachmentName = typeof body.attachmentName === "string" ? body.attachmentName.slice(0, 200) : null;
  if (!text && !attachmentName) return Response.json({ error: "Please type a message first." }, { status: 400 });
  if (text.length > MAX_LEN)
    return Response.json({ error: `Your message is too long (max ${MAX_LEN} characters).` }, { status: 400 });

  try {
    const chat = await prisma.chatSession.findUnique({ where: { id }, include: { prompt: true } });
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });

    const userMsg = await prisma.message.create({
      data: { sessionId: id, role: "user", content: text || `(attached file: ${attachmentName})`, attachmentName },
    });

    // simulated "thinking" delay
    await new Promise((r) => setTimeout(r, 1500));

    const [entries, tipCount] = await Promise.all([prisma.knowledgeEntry.findMany(), prisma.tip.count()]);
    const tip = tipCount ? await prisma.tip.findFirst({ skip: Math.floor(Math.random() * tipCount) }) : null;

    let reply;
    if (!text && attachmentName) {
      reply = {
        content: `Thanks, I can see you attached "${attachmentName}". I can't open files yet – please describe the room or your question in words and I'll help.`,
        source: null,
        related: [] as string[],
      };
    } else {
      reply = answer(text, entries, {
        model: chat.model,
        persona: chat.prompt?.name,
        temperature: chat.temperature,
        topP: chat.topP,
        extraTip: tip?.text,
      });
    }

    const assistantMsg = await prisma.message.create({
      data: { sessionId: id, role: "assistant", content: reply.content, source: reply.source, related: reply.related },
    });

    const isFirst = chat.title === "New chat";
    await prisma.chatSession.update({
      where: { id },
      data: isFirst && text ? { title: text.length > 50 ? text.slice(0, 47) + "…" : text } : { updatedAt: new Date() },
    });

    return Response.json({ user: userMsg, assistant: assistantMsg });
  } catch (e) {
    return dbError(e);
  }
}
