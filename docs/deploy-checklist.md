# Production / Deploy Checklist

## Environment
- [ ] `DATABASE_URL` configurada en runtime y apuntando a Postgres productivo.
- [ ] `AUTH_SECRET` configurada.
- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` configuradas para OAuth.

## Database
- [ ] `npx prisma generate`
- [ ] `npx prisma migrate deploy`
- [ ] `npm run seed`

## Validation
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Smoke test manual de login, upload, CRUD de trades/fills y reportes PDF/CSV.

## Deployment
- [ ] Desplegar artefacto/app.
- [ ] Verificar healthcheck y logs.
- [ ] Verificar creación/edición/eliminación en UI y API.
