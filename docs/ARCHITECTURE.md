# HUNT//OS architecture

```
Government / weather source
        │
   GIS / weather adapter
        │
 validation + normalization + provenance
        │
  Next.js API  (later: Fastify + PostGIS tiles)
        │
  mobile/web cache (IndexedDB, Cache API)
        │
     MapLibre
```

## Packages

- `@huntos/core` — deterministic engines and provider interfaces
- `@huntos/web` — field instrument UI
- `packages/db` — PostGIS migrations
- `data-sources/` — federal and per-state configuration only

## GIS providers

`GISProvider` is the only interface the UI/API use.

Implemented:

- ArcGIS MapServer / FeatureServer query (`f=geojson`)
- In-memory GeoJSON (tests / offline packages)

Configured, not yet wired as live fetchers:

- WFS, shapefile, GeoPackage, PMTiles, vector tiles

## AI path

```
User → orchestrator → GIS/terrain/weather/user tools
     → structured evidence → scoreHabitat()
     → LLM or template explanation → inferred overlay
```

The model never writes boundaries, seasons, or legal status.

## Offline

Mutable entities carry `localId`, `serverId`, `version`, and `syncStatus`.
Failed uploads stay in the queue. Conflicts are marked, not discarded.

## Privacy

User-generated locations default to `private`. Precise sharing is opt-in.

## Future clients

Scout Vision / AR should consume the same entities (waypoints, bearings, public geometry, inferred annotations) through `@huntos/core` — not through React components.
