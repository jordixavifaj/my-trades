# My Trades

Trading journal application built with Next.js 14, TypeScript, TailwindCSS, Prisma, and PostgreSQL.

## Production-ready updates included

- Runtime guard for `DATABASE_URL` so Prisma fails fast with clear error if missing.
- Google OAuth login flow (custom implementation) in addition to email/password auth.
- Real PDF binary generation for reports endpoint.
- Full UI CRUD for trades and fills (create/edit/delete) wired to existing APIs.
- CI workflow (`lint`, `typecheck`, `build`) + seed script + deploy checklist.

> ⚠️ Note: Installing new npm packages is blocked in this environment, so a full migration to **NextAuth** and true binary `.xls` parsing libraries could not be completed here.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database running

### Installation

```bash
npm install
cp .env.example .env.local
```

Set at least:

- `DATABASE_URL`
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Database setup

```bash
npx prisma generate
npx prisma migrate dev
npm run seed
```

### Run

```bash
npm run dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run check`
- `npm run seed`

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

## Deployment checklist

See: `docs/deploy-checklist.md`
