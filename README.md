# Lumi – Sirena Kids' Room Guide

Educational chat assistant of [Sirena](https://sirena.ee) that helps parents plan safe, practical and child-friendly kids' rooms (safety, layout, storage, sleep, Montessori, play corners, lighting, colours).

TalTech – Tarkvaratehnoloogia, homework 8 (Claude Code + GitHub + Railway).

## Stack
- Next.js 15 (App Router, TypeScript), Tailwind CSS, Lucide icons
- PostgreSQL on Railway via Prisma ORM
- Answers come from the knowledge base in `data/knowledge_base.csv` (30 Q&A) and `data/tips.csv` (10 tips) using keyword/word-overlap matching – no external AI API key is needed. If nothing matches well enough, Lumi says it does not know instead of guessing.

## Features
- Chat history sidebar (stored in PostgreSQL), new chat, delete chat
- Answer model dropdown (Lumi Basic / Detailed / Quick Tips) and persona dropdown (Room Planner, Safety Advisor, Montessori Guide) + **Manage Prompts** modal (add / edit / delete)
- Temperature & Top-P sliders saved per chat
- Typing indicator, timestamps, source label, clickable related questions, tip of the moment
- Attach-file button (file name is stored), Clear Chat, friendly error messages (database unreachable, empty or too long message)
- Responsive: hamburger menu on mobile

## Railway
1. New Project → Database → PostgreSQL
2. + New → GitHub Repo → this repo
3. App service → Variables → `DATABASE_URL = ${{Postgres.DATABASE_URL}}`
4. Settings → Networking → Generate Domain

`npm run build` = `prisma generate && next build`; `npm start` = `prisma migrate deploy && prisma db seed && next start` (seed is idempotent). The server listens on `PORT`.

## API
`GET/POST /api/chats`, `GET/PATCH/DELETE /api/chats/[id]`, `POST /api/chats/[id]/messages`, `GET/POST /api/prompts`, `PUT/DELETE /api/prompts/[id]`, `GET /api/tips`
