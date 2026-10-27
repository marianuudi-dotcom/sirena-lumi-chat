// Lumi answer engine: keyword / word-overlap retrieval from the knowledge base (no external AI API).
import type { KnowledgeEntry } from "@prisma/client";

export const MODELS = ["Lumi Basic", "Lumi Detailed", "Lumi Quick Tips"] as const;

const STOP = new Set(
  "a an and are as at be by can do does for from how i if in is it its me my of on or our should so that the their them there these this to was what when where which who why will with you your we us any some about into than then also have has had very just more most much get".split(" ")
);

function stem(w: string) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es") && /(sh|ch|x|s)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  return w;
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z0-9]+/g) ?? [])
    .filter((w) => !STOP.has(w) && w.length > 1)
    .map(stem);
}

export type Scored = { entry: KnowledgeEntry; score: number };

export function rank(query: string, entries: KnowledgeEntry[], persona?: string): Scored[] {
  const q = tokens(query);
  const qSet = new Set(q);
  const qLower = query.toLowerCase();
  if (q.length === 0) return [];
  return entries
    .map((entry) => {
      let score = 0;
      const kwPhrases = entry.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      for (const phrase of kwPhrases) {
        if (phrase.includes(" ") && qLower.includes(phrase)) score += 4;
      }
      const kw = new Set(tokens(entry.keywords));
      const qu = new Set(tokens(entry.question));
      const an = new Set(tokens(entry.answer));
      const cat = new Set(tokens(entry.category));
      for (const t of qSet) {
        if (kw.has(t)) score += 3;
        if (qu.has(t)) score += 2;
        if (cat.has(t)) score += 1.5;
        if (an.has(t)) score += 0.5;
      }
      // normalise a little so long queries don't dominate
      score = score / Math.sqrt(Math.max(qSet.size, 1));
      if (persona === "Safety Advisor" && entry.category === "Safety") score *= 1.15;
      if (persona === "Montessori Guide" && /montessori/i.test(entry.category + entry.keywords)) score *= 1.15;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);
}

export const MIN_SCORE = 2.2;

const OPENERS: Record<string, string> = {
  "Room Planner": "Here's a practical planning tip:",
  "Safety Advisor": "Safety first – here's what matters most:",
  "Montessori Guide": "From a Montessori point of view:",
};

function sentences(text: string) {
  const raw = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
  // merge very short sentences ("Yes.") into the next one
  const out: string[] = [];
  let carry = "";
  for (const s of raw) {
    const joined = carry ? `${carry} ${s}` : s;
    if (joined.length < 20) carry = joined;
    else {
      out.push(joined);
      carry = "";
    }
  }
  if (carry) out.push(carry);
  return out.length ? out : [text];
}

export type LumiAnswer = { content: string; source: string | null; related: string[] };

export function answer(
  query: string,
  entries: KnowledgeEntry[],
  opts: { model: string; persona?: string | null; temperature: number; topP: number; extraTip?: string | null }
): LumiAnswer {
  const ranked = rank(query, entries, opts.persona ?? undefined);
  const best = ranked[0];
  if (!best || best.score < MIN_SCORE) {
    const suggestions = [...entries].sort(() => Math.random() - 0.5).slice(0, 3).map((e) => e.question);
    return {
      content:
        "I'm sorry, I don't know the answer to that yet. I can help with kids' room safety, layout, storage, sleep, lighting, colours, Montessori ideas and play corners. For product, order or delivery questions please contact Sirena customer support at klienditugi@sirena.ee.",
      source: null,
      related: suggestions,
    };
  }
  const e = best.entry;
  let body = e.answer;
  if (opts.topP < 0.4) body = sentences(body)[0];
  if (opts.model === "Lumi Quick Tips") {
    const s = sentences(body).slice(0, 3);
    body = s.map((x) => `• ${x}`).join("\n");
  }
  const opener = opts.persona ? (OPENERS[opts.persona] ?? `${opts.persona} here – my advice:`) + "\n\n" : "";
  let content = opener + body;
  if (opts.model === "Lumi Detailed") content += `\n\nTopic: ${e.category} · Age group: ${e.ageGroup}`;
  if (opts.temperature > 0.6 && opts.extraTip) content += `\n\n💡 Extra tip: ${opts.extraTip}`;
  const related = ranked
    .slice(1)
    .filter((r) => r.score > 0)
    .slice(0, 2)
    .map((r) => r.entry.question);
  return { content, source: `${e.category} · ${e.ageGroup}`, related };
}
