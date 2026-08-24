# What was implemented

## Phase 1 — Foundation

- Monorepo, strict TypeScript
- Auth abstraction (local identity; Supabase placeholders)
- MapLibre field map, USGS basemaps via same-origin tile proxy
- GIS provider interface + PAD-US adapter
- Dataset registry + admin enable/disable + health checks
- GPS instrument, breadcrumbs, waypoints, layer panel
- Property / access card with provenance and boundary warning

## Phase 2 — Texas MVP (started)

- Texas state module and default extent (Sam Houston NF area for PAD-US coverage)
- Hunt areas
- Offline region download (visible extent tile + GIS cache)
- Regulations / hunting-unit tables and unconfigured adapters (no invented TPWD data)

## Phase 3 — Terrain (started)

- Elevation sampling (Open-Meteo)
- Deterministic slope / aspect / terrain position
- Hillshade overlay from USGS

## Phase 4 — Hunting intelligence (started)

- Habitat cells and modular species models (whitetail default)
- Scores, confidence, missing-factor tracking
- AI Scout wizard + inferred map overlay
- WHY HERE reasons from the scoring engine

## Phase 5 — Field intelligence (started)

- Open-Meteo weather / wind card
- Wind evaluation + what-if helper in core
- Hunt/track session recording
- Personal observation analytics helpers (not yet a full journal UI)

## Phase 6–7

- Trail-camera entity + image-analysis interface shape in schema
- Western state adapter stubs (CO, WY, MT, ID, UT)

## Remaining work

- Native React Native / Expo client
- PostGIS ingest jobs, tile generation, version compare
- Official TPWD hunting-unit endpoint when published/configured
- Structured regulation import (never LLM-authored)
- Full DEM / land-cover / hydrography packages
- Trail-camera vision service
- Party sharing and AR overlays
- Production auth and object storage
