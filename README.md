# HUNT//OS

**Hunting Intelligence. Anywhere.**

Offline-first hunting intelligence and mapping platform. This repository was an empty `Nomad` stub. HUNT//OS is the product being built here.

The app opens on a full-screen MapLibre field map. Authoritative GIS, hunter observations, and model inference are kept on separate truth layers and are never silently mixed.

## Implementation map (repository inspection)

### EXISTING — KEEP

- Git remote and history (`TheAlienNetwork/Nomad`)
- Empty-repo bootstrap (no application stack existed)

### EXISTING — ENHANCE

- `README.md` — replaced the one-line Nomad stub with product and architecture documentation

### NEW — ADD

- `packages/core` — GIS adapters, provenance, terrain, habitat scoring, wind, weather, sync, AI safety
- `packages/db/migrations` — PostGIS schema for production
- `apps/web` — Next.js field client (MapLibre GL JS), offline cache, admin data-health
- `data-sources/federal` and `data-sources/states/*` — adapter configuration, Texas first
- Dataset registry with enable/disable without a rebuild
- Vertical slice: map → GPS → PAD-US overlay → provenance card → offline waypoints → sync → terrain → whitetail scoring → inferred overlay

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web client | Next.js 15 + MapLibre GL JS | Repo had no React Native app; web is verifiable and the core engine is UI-agnostic |
| Core | TypeScript package `@huntos/core` | Shared by web now, native/AR later |
| Offline | Dexie + Cache API / service worker | Waypoints and tiles survive disconnects |
| Server GIS | Next.js route handlers wrapping adapters | UI never calls an agency API directly |
| Authoritative land | USGS PAD-US 4.1 Fee MapServer | Official National Map service, configurable |
| Basemaps | USGS The National Map topo / imagery / hillshade | Public-domain government tiles |
| Weather / DEM samples | Open-Meteo | No API key; provider is swappable |
| Auth | Local identity abstraction | Supabase env placeholders; no fake login |
| Production DB | PostgreSQL + PostGIS migrations | Applied when `DATABASE_URL` is present |

React Native / Expo is the intended mobile shell. Core intelligence is not coupled to it.

## Truth layers

1. **Authoritative** — government/verified GIS, elevation samples, official access codes
2. **Observed** — the hunter's waypoints, tracks, cameras, harvests
3. **Inferred** — habitat scores, wind class, AI narrative, movement guesses

If a source is missing, HUNT//OS reports unknown. It does not invent property lines, public/private status, seasons, bag limits, or legal access.

## Development

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Open `http://localhost:3000` for the map and `/admin` for dataset health.

### Credentials

None are required for the V1 vertical slice.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | No | Optional LLM wording around structured scores |
| `NEXT_PUBLIC_SUPABASE_URL` / keys | No | Future auth |
| `DATABASE_URL` | No | Apply `packages/db/migrations` for production PostGIS |
| `TPWD_HUNTING_UNITS_URL` | No | Official Texas hunting-unit service when you have it |
| `PADUS_FEATURE_URL` | No | Override if the USGS endpoint changes |

Copy `.env.example` to `apps/web/.env.local`.

Production (single-node VPS): set `AUTH_SECRET`, run `npm run build && npm run start`, back up `HUNTOS_DATA_FILE`. See `docs/PRODUCTION.md`. `GET /api/health` must be ok.

This is a private/team V1, not a nationwide consumer launch. Regulations and complete Texas public access are still not invented.

## Safety

- PAD-US Fee is an aggregation. Managing agencies remain the official source.
- Absence of a PAD-US polygon is **unknown**, not private land.
- GIS lines do not override signs, fences, landowner instructions, regulations, or closures.
- Habitat scores are heuristics, not animal-presence claims.

## License / attribution

USGS The National Map and PAD-US 4.1 (`https://doi.org/10.5066/P96WBCHS`). Weather/elevation: Open-Meteo. Street style option: OpenFreeMap / OSM contributors.
