# MailLab — Claude Code Guide

## Project
Educational mail + file storage platform for QA automation students.
Two modules: Mail (send/receive with attachments) and Disk (folders, files, trash).

## Stack
- Next.js 14 (App Router, TypeScript)
- Prisma + PostgreSQL
- NextAuth (credentials)
- Tailwind CSS
- Vitest (unit/integration)
- Playwright (e2e)
- Docker Compose

## Workflow — strict TDD
For every feature:
1. Read the relevant `specs/*.md` first.
2. Write failing tests (Vitest for logic/API, Playwright for UI flows).
3. Run tests, confirm they fail for the right reason.
4. Implement minimal code to make them pass.
5. Refactor if needed, tests still green.
6. Run full suite. Only then commit.

Never write implementation before the test exists.
Never modify tests to make them pass — fix the implementation.

## Commands
- `npm run dev` — dev server
- `npm test` — Vitest watch
- `npm run test:run` — Vitest one-shot
- `npm run test:e2e` — Playwright
- `npm run db:migrate` — `prisma migrate dev`
- `npm run db:reset` — wipe + reseed
- `docker compose up -d` — local stack

## Conventions
- API routes return JSON, no redirects, status codes are meaningful.
- Server actions only for forms, otherwise REST endpoints under `/api/`.
- File storage: actual files on disk under `./storage/`, metadata in DB.
- All times UTC in DB, formatted on client.
- No `any`, no `@ts-ignore` without comment.

## Git
- Conventional commits: `feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`.
- Commit after each green TDD cycle (test + impl together is OK).
- Never commit with failing tests.
- Never commit `.env` or `storage/`.

## Out of scope (don't add)
- Real SMTP / IMAP integration.
- Email-to-email between separate servers.
- Markdown rendering in mail body (plain text only).
- Roles/admin panel.
