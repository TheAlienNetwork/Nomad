"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BOUNDARY_CONFIDENCE_WARNING,
  WAYPOINT_TYPES,
  formatBearing,
  formatDistance,
  haversineMeters,
  initialBearingDegrees,
  type IdentifyResult,
  type Waypoint,
  type WaypointType,
} from "@huntos/core";
import { TEXAS_PUBLIC_LAND_PLACES, matchPublicLandPlace } from "@/lib/places";
import { closeSheet, flyToBounds, openSheet, useHuntStore, type LayerState } from "@/lib/store";

function TruthBadge({ layer }: { layer: "authoritative" | "observed" | "inferred" }) {
  const label =
    layer === "authoritative"
      ? "AUTHORITATIVE"
      : layer === "observed"
        ? "OBSERVED"
        : "AI ANALYSIS";
  const color =
    layer === "authoritative"
      ? "text-field-moss border-field-moss/40"
      : layer === "observed"
        ? "text-field-observe border-field-observe/40"
        : "text-field-infer border-field-infer/40";
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] ${color}`}>
      {label}
    </span>
  );
}

function Sheet({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[72vh] overflow-y-auto rounded-t-3xl border border-field-line bg-field-panel/95 p-4 shadow-instrument backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-[0.28em] text-field-amber">{title}</h2>
        <button type="button" className="btn-ghost" onClick={closeSheet}>
          CLOSE
        </button>
      </div>
      {children}
    </aside>
  );
}

export function TopBar() {
  const weather = useHuntStore((state) => state.weather);
  const online = useHuntStore((state) => state.online);
  const gps = useHuntStore((state) => state.gps);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
      <div className="panel pointer-events-auto px-3 py-2">
        <p className="font-mono text-[10px] tracking-[0.35em] text-field-amber">HUNT//OS</p>
        <p className="text-xs text-field-mist/70">Hunting Intelligence. Anywhere.</p>
      </div>
      <div className="flex max-w-[58%] flex-wrap justify-end gap-2">
        <form
          className="panel pointer-events-auto flex items-center gap-2 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            const query = String(new FormData(event.currentTarget).get("q") || "");
            const place = matchPublicLandPlace(query);
            if (place) {
              flyToBounds(place.id, place.bounds);
              closeSheet();
            }
          }}
        >
          <span className="font-mono text-[10px] text-field-mist/50">SEARCH</span>
          <input
            name="q"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-field-mist/30"
            placeholder="Davy Crockett / Sam Houston"
          />
        </form>
        <button
          type="button"
          className="panel pointer-events-auto px-3 py-2 text-left"
          onClick={() => openSheet("gps")}
        >
          <p className="font-mono text-[10px] text-field-mist/50">WX / WIND</p>
          <p className="font-mono text-sm">
            {weather
              ? `${Math.round(weather.temperatureC ?? 0)}°C · ${weather.windDirectionFromDegrees ?? "—"}°`
              : "NO WX"}
          </p>
        </button>
        <div className="panel px-3 py-2">
          <p className="font-mono text-[10px] text-field-mist/50">LINK</p>
          <p className={`font-mono text-sm ${online ? "text-field-moss" : "text-field-danger"}`}>
            {online ? "ONLINE" : "OFFLINE"}
          </p>
        </div>
        <div className="panel px-3 py-2">
          <p className="font-mono text-[10px] text-field-mist/50">FIX</p>
          <p className="font-mono text-sm">
            {gps.source === "none" ? "NO FIX" : gps.source.toUpperCase()}
          </p>
        </div>
      </div>
    </header>
  );
}

export function Dock({
  onLocate,
  onWaypoint,
  onReturn,
}: {
  onLocate: () => void;
  onWaypoint: () => void;
  onReturn: () => void;
}) {
  const fieldMode = useHuntStore((state) => state.fieldMode);
  const buttons = [
    { id: "locate", label: "LOCATE", action: onLocate },
    { id: "waypoint", label: "WAYPOINT", action: onWaypoint },
    { id: "scout", label: "SCOUT", action: () => openSheet("scout") },
    { id: "layers", label: "LAYERS", action: () => openSheet("layers") },
    {
      id: "field",
      label: fieldMode ? "FIELD ON" : "FIELD",
      action: () => useHuntStore.setState({ fieldMode: !fieldMode }),
    },
  ] as const;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3">
      <button type="button" className="btn-primary pointer-events-auto w-full max-w-md" onClick={onReturn}>
        RETURN TO TRUCK
      </button>
      <nav className="pointer-events-auto grid w-full max-w-md grid-cols-5 gap-2">
        {buttons.map((button) => (
          <button key={button.id} type="button" className="btn-dock" onClick={button.action}>
            {button.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function LayersPanel() {
  const sheet = useHuntStore((state) => state.sheet);
  const basemap = useHuntStore((state) => state.basemap);
  const layers = useHuntStore((state) => state.layers);
  if (sheet !== "layers") return null;
  const toggle = (key: keyof LayerState) => {
    useHuntStore.setState({ layers: { ...layers, [key]: !layers[key] } });
  };
  return (
    <Sheet title="LAYERS">
      <section className="space-y-4 text-sm">
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">BASEMAP</p>
          {(["topo", "satellite", "hybrid", "streets"] as const).map((id) => (
            <label key={id} className="flex items-center gap-2 py-1">
              <input
                type="radio"
                name="basemap"
                checked={basemap === id}
                onChange={() => useHuntStore.setState({ basemap: id })}
              />
              {id}
            </label>
          ))}
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">LAND</p>
          <Toggle checked={layers.publicLand} onChange={() => toggle("publicLand")} label="Public Land (PAD-US)" />
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">HUNT</p>
          <Toggle checked={layers.huntingUnits} onChange={() => toggle("huntingUnits")} label="Hunting Units (unconfigured)" />
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">TERRAIN</p>
          <Toggle checked={layers.hillshade} onChange={() => toggle("hillshade")} label="Hillshade" />
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">INTELLIGENCE</p>
          <p className="mb-1 text-xs text-field-infer">Inferred overlays use a distinct magenta style.</p>
          <Toggle checked={layers.huntScore} onChange={() => toggle("huntScore")} label="AI Hunt Score" />
          <Toggle checked={layers.bedding} onChange={() => toggle("bedding")} label="Bedding" />
          <Toggle checked={layers.feeding} onChange={() => toggle("feeding")} label="Feeding" />
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">MY DATA</p>
          <Toggle checked={layers.waypoints} onChange={() => toggle("waypoints")} label="Waypoints" />
          <Toggle checked={layers.tracks} onChange={() => toggle("tracks")} label="Tracks" />
        </div>
      </section>
    </Sheet>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 py-1">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function PropertySheet({
  result,
  coordinate,
}: {
  result?: IdentifyResult;
  coordinate?: { lng: number; lat: number };
}) {
  const sheet = useHuntStore((state) => state.sheet);
  if (sheet !== "property" && sheet !== "intel") return null;
  const feature = result?.features[0];
  return (
    <Sheet title={sheet === "intel" ? "LOCATION INTELLIGENCE" : "LAND STATUS"}>
      {coordinate && (
        <p className="mb-2 font-mono text-xs text-field-mist/70">
          {coordinate.lat.toFixed(5)}, {coordinate.lng.toFixed(5)}
        </p>
      )}
      <TruthBadge layer="authoritative" />
      {!result?.found ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>{result?.message ?? "No identify result yet."}</p>
          {result?.features[0] && (
            <div className="rounded-xl border border-field-line p-3">
              <p className="text-xs text-field-mist/60">Nearby record (not a containment match)</p>
              <p className="text-lg">{result.features[0].properties.name ?? "Unnamed unit"}</p>
              <p>Managing Agency: {result.features[0].properties.manager ?? "Unknown"}</p>
              <p>Dataset: {result.features[0].provenance.name}</p>
              <p>Retrieved: {result.features[0].provenance.retrievedAt}</p>
            </div>
          )}
          <p className="text-field-amber">{BOUNDARY_CONFIDENCE_WARNING}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-lg">{feature?.properties.name ?? "Unnamed unit"}</p>
          <p>Managing Agency: {feature?.properties.manager ?? "Unknown"}</p>
          <p>Access code: {feature?.properties.access ?? "unknown"}</p>
          <p>Dataset: {feature?.provenance.name}</p>
          <p>Agency: {feature?.provenance.agency}</p>
          <p>Version: {feature?.provenance.version ?? "—"}</p>
          <p>Retrieved: {feature?.provenance.retrievedAt}</p>
          <p>Source date: {feature?.properties.sourceDate ?? "—"}</p>
          <a className="text-field-amber underline" href={feature?.provenance.sourceUrl} target="_blank" rel="noreferrer">
            Source record
          </a>
          <p className="text-field-amber">{BOUNDARY_CONFIDENCE_WARNING}</p>
        </div>
      )}
    </Sheet>
  );
}

export function WaypointSheet({
  onSave,
}: {
  onSave: (input: { type: WaypointType; name: string; notes: string }) => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const draftType = useHuntStore((state) => state.draftWaypointType);
  if (sheet !== "waypoint") return null;
  return (
    <Sheet title="NEW WAYPOINT">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSave({
            type: (data.get("type") as WaypointType) || draftType,
            name: String(data.get("name") || "Untitled"),
            notes: String(data.get("notes") || ""),
          });
        }}
      >
        <label className="block text-sm">
          Type
          <select name="type" defaultValue={draftType} className="input mt-1">
            {WAYPOINT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Name
          <input name="name" className="input mt-1" defaultValue="Field mark" />
        </label>
        <label className="block text-sm">
          Notes
          <textarea name="notes" className="input mt-1" rows={3} />
        </label>
        <p className="text-xs text-field-mist/60">
          Saved locally first (private). Syncs when a link is available.
        </p>
        <button type="submit" className="btn-primary w-full">
          SAVE OFFLINE
        </button>
      </form>
    </Sheet>
  );
}

export function ScoutSheet({
  onAnalyze,
}: {
  onAnalyze: () => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const scout = useHuntStore((state) => state.scout);
  const result = useHuntStore((state) => state.scoutResult) as
    | {
        explanation?: {
          headline: string;
          narrative: string;
          confidence: number;
          warnings: string[];
          setups: Array<{
            scores: { overall: number | null };
            reasons: string[];
            confidence: number;
          }>;
        };
      }
    | undefined;
  if (sheet !== "scout") return null;
  return (
    <Sheet title="AI SCOUT">
      <div className="space-y-3 text-sm">
        <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">WHAT ARE YOU HUNTING?</p>
        <div className="grid grid-cols-2 gap-2">
          {(["whitetail", "mule_deer", "elk", "turkey"] as const).map((species) => (
            <button
              key={species}
              type="button"
              className={scout?.species === species ? "btn-primary" : "btn-dock"}
              onClick={() =>
                useHuntStore.setState({
                  scout: { ...(scout ?? { period: "now", area: "visible", stage: "when" }), species, period: scout?.period ?? "now", area: scout?.area ?? "visible", stage: "when" },
                })
              }
            >
              {species.replace("_", " ")}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">WHEN?</p>
        <div className="grid grid-cols-4 gap-2">
          {(["now", "morning", "evening", "custom"] as const).map((period) => (
            <button
              key={period}
              type="button"
              className={scout?.period === period ? "btn-primary" : "btn-dock"}
              onClick={() =>
                useHuntStore.setState({
                  scout: { ...(scout as NonNullable<typeof scout>), period },
                })
              }
            >
              {period}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary w-full" onClick={onAnalyze}>
          ANALYZE VISIBLE MAP
        </button>
        {result?.explanation && (
          <div className="space-y-2 rounded-xl border border-field-infer/40 p-3">
            <TruthBadge layer="inferred" />
            <p className="text-lg">{result.explanation.headline}</p>
            <p>Overall confidence {Math.round(result.explanation.confidence * 100)}%</p>
            <p>{result.explanation.narrative}</p>
            {result.explanation.setups.map((setup, index) => (
              <div key={index} className="border-t border-field-line pt-2">
                <p>SETUP {index + 1} — {setup.scores.overall ?? "—"}/100</p>
                <p className="text-field-mist/70">{setup.reasons.join(" · ")}</p>
              </div>
            ))}
            {result.explanation.warnings.map((warning) => (
              <p key={warning} className="text-field-amber">
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function DownloadSheet({
  onDownload,
}: {
  onDownload: () => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const progress = useHuntStore((state) => state.downloadProgress);
  const bounds = useHuntStore((state) => state.mapBounds);
  if (sheet !== "download") return null;
  return (
    <Sheet title="DOWNLOAD HUNT AREA">
      <div className="space-y-2 text-sm">
        <p>Caches the visible extent: USGS topo tiles, PAD-US identify package, waypoints, and last AI overlay.</p>
        <p className="font-mono text-xs">
          {bounds
            ? `${bounds.west.toFixed(3)}, ${bounds.south.toFixed(3)} → ${bounds.east.toFixed(3)}, ${bounds.north.toFixed(3)}`
            : "No extent yet"}
        </p>
        {progress && (
          <p>
            {progress.label} {progress.done}/{progress.total}
          </p>
        )}
        <button type="button" className="btn-primary w-full" onClick={onDownload}>
          DOWNLOAD VISIBLE AREA
        </button>
      </div>
    </Sheet>
  );
}

export function ReturnSheet({
  truck,
}: {
  truck?: Waypoint;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const gps = useHuntStore((state) => state.gps);
  if (sheet !== "return") return null;
  const from =
    gps.latitude !== undefined && gps.longitude !== undefined
      ? { latitude: gps.latitude, longitude: gps.longitude }
      : null;
  const distance =
    from && truck ? haversineMeters(from, { latitude: truck.latitude, longitude: truck.longitude }) : null;
  const bearing =
    from && truck ? initialBearingDegrees(from, { latitude: truck.latitude, longitude: truck.longitude }) : null;
  return (
    <Sheet title="RETURN TO TRUCK">
      {!truck ? (
        <p>Save a waypoint typed Truck first. No location is invented.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <p>{truck.name}</p>
          <p>
            Straight-line: {distance !== null ? formatDistance(distance) : "need a GPS or operator fix"}{" "}
            {bearing !== null ? formatBearing(bearing) : ""}
          </p>
          <p className="text-field-amber">
            A straight line is not a safe or legal route. Use breadcrumbs or mapped roads when available.
          </p>
        </div>
      )}
    </Sheet>
  );
}

export function AreasSheet({
  onSaveArea,
}: {
  onSaveArea: (name: string) => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const areas = useHuntStore((state) => state.huntAreas);
  if (sheet !== "areas") return null;
  return (
    <Sheet title="HUNT AREAS">
      <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">
        TEXAS PUBLIC LAND (PAD-US)
      </p>
      <p className="mb-3 text-xs text-field-mist/60">
        These jump to a map frame. Boundaries still come from PAD-US Fee — they are not drawn by HUNT//OS.
      </p>
      <ul className="mb-4 space-y-2 text-sm">
        {TEXAS_PUBLIC_LAND_PLACES.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              className="w-full rounded border border-field-line p-3 text-left"
              onClick={() => {
                flyToBounds(place.id, place.bounds);
                closeSheet();
              }}
            >
              <p>{place.name}</p>
              <p className="font-mono text-[10px] text-field-mist/50">
                {place.agency} · {place.state} · PAD-US Fee
              </p>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get("name") || "");
          if (name) onSaveArea(name);
          event.currentTarget.reset();
        }}
      >
        <input name="name" className="input" placeholder="Save visible extent" />
        <button type="submit" className="btn-primary">
          SAVE
        </button>
      </form>
      <ul className="space-y-2 text-sm">
        {areas.map((area) => (
          <li key={area.id} className="rounded border border-field-line p-2">
            {area.name}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function GpsSheet({
  onStartTrack,
  onPauseTrack,
  onOperatorFix,
}: {
  onStartTrack: () => void;
  onPauseTrack: () => void;
  onOperatorFix: () => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const gps = useHuntStore((state) => state.gps);
  const weather = useHuntStore((state) => state.weather);
  const tracks = useHuntStore((state) => state.tracks);
  const recording = tracks.some((track) => track.status === "recording");
  if (sheet !== "gps") return null;
  return (
    <Sheet title="FIELD GPS">
      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
        <Readout label="LAT" value={gps.latitude?.toFixed(5) ?? "—"} />
        <Readout label="LNG" value={gps.longitude?.toFixed(5) ?? "—"} />
        <Readout label="ALT" value={gps.altitude !== undefined ? `${Math.round(gps.altitude)} m` : "—"} />
        <Readout label="ACC" value={gps.accuracy !== undefined ? `${Math.round(gps.accuracy)} m` : "—"} />
        <Readout label="HDG" value={gps.heading !== undefined ? `${Math.round(gps.heading)}°` : "—"} />
        <Readout label="SPD" value={gps.speed !== undefined ? `${gps.speed.toFixed(1)} m/s` : "—"} />
      </div>
      <p className="mt-2 text-xs text-field-mist/60">Source: {gps.source}. Errors: {gps.error ?? "none"}</p>
      {weather && (
        <p className="mt-2 text-sm">
          {Math.round(weather.temperatureC ?? 0)}°C · wind {weather.windDirectionFromDegrees ?? "—"}° at{" "}
          {weather.windSpeedMps?.toFixed(1) ?? "—"} m/s
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" onClick={recording ? onPauseTrack : onStartTrack}>
          {recording ? "PAUSE TRACK" : "RECORD TRACK"}
        </button>
        <button type="button" className="btn-dock" onClick={onOperatorFix}>
          OPERATOR FIX
        </button>
      </div>
    </Sheet>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-field-line p-2">
      <p className="text-[10px] text-field-mist/50">{label}</p>
      <p>{value}</p>
    </div>
  );
}

export function FieldExtras() {
  return (
    <div className="pointer-events-auto absolute left-3 top-28 z-20 flex flex-col gap-2">
      <button type="button" className="btn-dock" onClick={() => openSheet("download")}>
        DOWNLOAD
      </button>
      <button type="button" className="btn-dock" onClick={() => openSheet("areas")}>
        AREAS
      </button>
      <Link className="btn-dock text-center" href="/admin">
        DATA HEALTH
      </Link>
    </div>
  );
}
