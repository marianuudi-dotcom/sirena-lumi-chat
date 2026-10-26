// Idempotent seed: default personas + knowledge base CSV + tips CSV.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const personas = [
  { name: "Room Planner", content: "You are Lumi, a friendly kids' room planner from Sirena. Give practical, step-by-step room planning advice." },
  { name: "Safety Advisor", content: "You are Lumi, a careful safety advisor from Sirena. Put child safety first and mention the most important safety checks." },
  { name: "Montessori Guide", content: "You are Lumi, a Montessori-inspired guide from Sirena. Focus on independence, child-height furniture and calm, natural spaces." },
];

async function main() {
  for (const p of personas) {
    // Only create if missing, so user edits made in "Manage Prompts" are kept.
    await prisma.systemPrompt.upsert({ where: { name: p.name }, update: {}, create: p });
  }
  const dataDir = join(process.cwd(), "data");
  const kb = parseCsv(readFileSync(join(dataDir, "knowledge_base.csv"), "utf8"));
  for (const r of kb) {
    const entry = { category: r.category, ageGroup: r.age_group, question: r.question, answer: r.answer, keywords: r.keywords };
    await prisma.knowledgeEntry.upsert({ where: { id: r.id }, update: entry, create: { id: r.id, ...entry } });
  }
  const tips = parseCsv(readFileSync(join(dataDir, "tips.csv"), "utf8"));
  for (const t of tips) {
    await prisma.tip.upsert({ where: { id: t.id }, update: { text: t.tip }, create: { id: t.id, text: t.tip } });
  }
  console.log(`Seed done: ${personas.length} personas, ${kb.length} knowledge entries, ${tips.length} tips.`);
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
