# AfterLight — Starter (MVP scaffold)

This repository contains a minimal scaffold for the AfterLight MVP:
- **apps/api** — NestJS API (skeleton controllers mapped to OpenAPI)
- **apps/web** — Next.js (PWA-ready) landing + placeholders
- **docs/** — ERD (Mermaid) and C4 (PlantUML) drafts
- **api/openapi.yaml** — current draft (v0.1)
- **.github/workflows/ci.yml** — basic build/lint workflow

## Prereqs
- Node.js >= 20 (recommend using `nvm`)
- pnpm >= 9 (`npm i -g pnpm`)

## Quick start
```bash
# 1) install deps per app
cd apps/api && pnpm i && cd ../../
cd apps/web && pnpm i && cd ../../

# 2) run API
cd apps/api && pnpm start:dev

# 3) run Web
cd ../web && pnpm dev
```

## GitHub setup
1. Create a **private** GitHub repository (e.g. `afterlight`).
2. Locally:
```bash
git init
git add .
git commit -m "chore: bootstrap afterlight mvp scaffold"
git branch -M main
git remote add origin <YOUR_REPO_URL.git>
git push -u origin main
```
3. Configure repository secrets later for CI/CD (if needed).
