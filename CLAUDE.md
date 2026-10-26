# CLAUDE.md – Lumi (Sirena Kids' Room Guide)

- This is a web app that runs on **Railway**, not on the developer's computer.
- Railway deploys automatically from the **main** branch of this GitHub repo.
- The database is a **Railway PostgreSQL** database, available only through the `DATABASE_URL` environment variable on Railway. Do not set up a local database or a local server.
- Before every push run `npm run build` to make sure the app builds.
- After each finished task, commit and push to GitHub so that Railway deploys the new version.
- Knowledge base: `data/knowledge_base.csv` and `data/tips.csv` are imported by `prisma/seed.mjs` (idempotent, runs on every start).
