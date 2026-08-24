# Production deploy

HUNT//OS V1 is a single-node web field client. It is production-ready for a private or team deploy on a VPS. It is not a nationwide consumer launch.

## Required

```bash
export AUTH_SECRET="$(openssl rand -hex 32)"
export NODE_ENV=production
npm ci
npm test
npm run build
npm run start
```

`GET /api/health` must return `{ "ok": true }`.

## Persistence

User accounts, sessions, and synced waypoints are stored in:

```
HUNTOS_DATA_FILE=/var/lib/huntos/huntos-store.json
```

Default is `apps/web/data/huntos-store.json`. Back up that file. A process restart no longer drops field data.

Serverless hosts (Vercel) need a networked database. `DATABASE_URL` / PostGIS is the next persistence target; the schema is in `packages/db/migrations`.

## Auth

- Email + password (scrypt)
- HttpOnly session cookie
- Sync requires a signed-in account
- Offline marks still work without an account

## Do not ship as legal access advice

PAD-US Fee is incomplete. Texas hunting units and regulations stay unconfigured until an official TPWD source URL is set. The product must keep those unknown.

## Operations

- Reverse proxy with HTTPS
- Disk backups of `HUNTOS_DATA_FILE`
- Watch `/api/health` and `/admin`
- USGS and Open-Meteo are live dependencies
