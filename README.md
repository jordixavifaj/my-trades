# My Trades

Trading journal application built with Next.js 14, TypeScript, TailwindCSS, Prisma, and SQLite (desarrollo) / PostgreSQL (producción).

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
- SQLite (sin instalación extra) para desarrollo local o PostgreSQL para producción

### Installation

```bash
npm install
cp .env.example .env
```

Set at least:

- `DATABASE_URL` (por defecto: `file:./dev.db`)
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Database setup (SQLite recomendado en local)

```bash
npx prisma generate
npx prisma db push
npm run seed
```

> Si prefieres migraciones versionadas, puedes usar `npx prisma migrate dev`.

### Solución rápida para "Error interno en login"

Si el login devuelve `Error interno en login`, normalmente es porque falta `.env` o la base SQLite no está inicializada.

```bash
cp .env.example .env
npm run setup:login
```

Esto deja creado el usuario administrador de prueba:

- Email: `admin@mytrades.local`
- Password: `admin123`

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
