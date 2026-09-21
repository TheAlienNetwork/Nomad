"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BOUNDARY_CONFIDENCE_WARNING,
  OBSERVATION_WAYPOINT_TYPES,
  SPECIES,
  SPECIES_LABELS,
  WAYPOINT_TYPES,
  WAYPOINT_TYPE_LABELS,
  describeParcelStatus,
  formatBearing,
  formatDistance,
  formatLengthFeet,
  formatSpeedMph,
  formatTemperatureF,
  harvestHeatmap,
  harvestLocations,
  recordedKills,
  haversineMeters,
  initialBearingDegrees,
  overlayGroupLabel,
  overlaysForState,
  STATE_HUNT_GUIDES,
  estimateOverlayPack,
  packExtentForState,
  sanitizePackSelection,
  stateHuntGuide,
  type IdentifyResult,
  type SpeciesId,
  type Waypoint,
  type WaypointType,
} from "@huntos/core";
import { pickWebWaypointPhoto, patchWebWaypoint } from "@/lib/photos";
import { TEXAS_PUBLIC_LAND_PLACES, matchPublicLandPlace } from "@/lib/places";
import { closeSheet, flyToBounds, openSheet, setCameraMode, setHunterState, setMapTheme, setNeraMode, setNeraStyle, setPackSelection, useHuntStore, type LayerState, type NeraStyle } from "@/lib/store";
import { gpsRingHudLine } from "@/lib/gps-rings";
import {
  clampExaggeration,
  MAX_TERRAIN_EXAGGERATION,
  MIN_TERRAIN_EXAGGERATION,
  neraGridSpacingMeters,
  zoomFromBounds,
} from "@/lib/terrain-3d";

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

const EMPTY_TERRAIN_FEATURES: Array<{ label: string }> = [];

const TOPO_HILLS = [
  { cx: 110, cy: 110, rx: 150, ry: 88, rot: -18, n: 8 },
  { cx: 318, cy: 190, rx: 118, ry: 140, rot: 22, n: 7 },
  { cx: 80, cy: 380, rx: 148, ry: 92, rot: -9, n: 7 },
  { cx: 300, cy: 440, rx: 112, ry: 80, rot: 11, n: 6 },
  { cx: 200, cy: 270, rx: 84, ry: 56, rot: -4, n: 5 },
] as const;

function SheetTopo() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden rounded-t-3xl"
      viewBox="0 0 400 520"
      preserveAspectRatio="xMidYMid slice">
      {TOPO_HILLS.flatMap((hill, hillIndex) =>
        Array.from({ length: hill.n }, (_, step) => {
          const shrink = 1 - (step / Math.max(hill.n - 1, 1)) * 0.74;
          const indexContour = step % 3 === 2;
          return (
            <ellipse
              key={`${hillIndex}-${step}`}
              cx={hill.cx}
              cy={hill.cy}
              rx={hill.rx * shrink}
              ry={hill.ry * shrink}
              transform={`rotate(${hill.rot} ${hill.cx} ${hill.cy})`}
              fill="none"
              stroke={indexContour ? "rgba(241,90,36,0.16)" : "rgba(232,223,208,0.12)"}
              strokeWidth={indexContour ? 1.1 : 0.7}
            />
          );
        }),
      )}
    </svg>
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
    <aside className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[58vh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-cyan-400/20 bg-[rgba(2,8,12,0.86)] shadow-instrument backdrop-blur">
      <SheetTopo />
      <div className="relative z-10 max-h-[58vh] overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-xs tracking-[0.28em] text-field-amber">{title}</h2>
          <button type="button" className="btn-ghost" onClick={closeSheet}>
            CLOSE
          </button>
        </div>
        {children}
      </div>
    </aside>
  );
}

export function TopBar() {
  const weather = useHuntStore((state) => state.weather);
  const account = useHuntStore((state) => state.account);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
      <div className="panel pointer-events-auto px-3 py-1.5">
        <p className="font-mono text-[10px] tracking-[0.35em] text-cyan-200/80">HUNT//OS</p>
      </div>
      <div className="flex max-w-[62%] items-center justify-end gap-1.5">
        <form
          className="panel pointer-events-auto flex items-center gap-2 px-3 py-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const query = String(new FormData(event.currentTarget).get("q") || "");
            const place = matchPublicLandPlace(query);
            if (place) {
              flyToBounds(place.id, place.bounds, place.center);
              closeSheet();
            }
          }}
        >
          <span className="font-mono text-[10px] text-field-mist/50">SEARCH</span>
          <input
            name="q"
            className="w-40 bg-transparent text-sm outline-none placeholder:text-field-mist/30"
            placeholder="Davy Crockett / Sam Houston"
          />
        </form>
        <button
          type="button"
          className="panel pointer-events-auto px-2.5 py-1.5 text-left"
          onClick={() => openSheet("gps")}
        >
          <p className="font-mono text-[10px] text-field-mist/50">WX</p>
          <p className="font-mono text-xs">
            {weather
              ? `${formatTemperatureF(weather.temperatureC ?? Number.NaN)} · ${weather.windDirectionFromDegrees ?? "—"}°`
              : "—"}
          </p>
        </button>
        <button
          type="button"
          className="panel pointer-events-auto px-2.5 py-1.5 text-left"
          onClick={() => openSheet("account")}
        >
          <p className="font-mono text-[10px] text-field-mist/50">ACCOUNT</p>
          <p className="max-w-[8rem] truncate font-mono text-xs">
            {account?.email ?? "SIGN IN"}
          </p>
        </button>
      </div>
    </header>
  );
}

export function Dock({
  onLocate,
  onWaypoint,
  onReturn,
  onKill,
}: {
  onLocate: () => void;
  onWaypoint: () => void;
  onReturn: () => void;
  onKill: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const fieldMode = useHuntStore((state) => state.fieldMode);
  const followGps = useHuntStore((state) => state.followGps);
  const cameraMode = useHuntStore((state) => state.cameraMode);
  const selectedId = useHuntStore((state) => state.selectedWaypointId);
  const buttons = [
    { id: "locate", label: cameraMode === "fpv" ? "Recenter" : followGps ? "Follow" : "Locate", action: onLocate },
    { id: "waypoint", label: selectedId ? "Edit" : "Mark", action: onWaypoint },
    { id: "scout", label: "Scout", action: () => openSheet("scout") },
    { id: "layers", label: "Layers", action: () => openSheet("layers") },
    {
      id: "field",
      label: fieldMode ? "Field" : "Field",
      action: () => useHuntStore.setState({ fieldMode: !fieldMode }),
    },
  ] as const;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-1.5 px-3">
      {armed ? (
        <div className="pointer-events-auto flex gap-1">
          <button type="button" className="hud-chip is-kill" onClick={onKill}>
            Kill
          </button>
          <button type="button" className="hud-chip" onClick={onReturn}>
            Return
          </button>
        </div>
      ) : null}
      <nav className="pointer-events-auto hud-dock">
        {buttons.map((button) => (
          <button
            key={button.id}
            type="button"
            className={`hud-icon${button.id === "field" && fieldMode ? " is-live" : ""}${button.id === "waypoint" && selectedId ? " is-live" : ""}`}
            onClick={button.action}
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          className={`hud-icon${armed ? " is-live" : ""}`}
          onClick={() => setArmed((value) => !value)}
        >
          More
        </button>
      </nav>
    </div>
  );
}

export function LayersPanel() {
  const sheet = useHuntStore((state) => state.sheet);
  const basemap = useHuntStore((state) => state.basemap);
  const layers = useHuntStore((state) => state.layers);
  const hunterState = useHuntStore((state) => state.hunterState);
  const cameraMode = useHuntStore((state) => state.cameraMode);
  const online = useHuntStore((state) => state.online);
  const waypoints = useHuntStore((state) => state.waypoints);
  const selectedId = useHuntStore((state) => state.selectedWaypointId);
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
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">3D RELIEF</p>
          <p className="mb-1 text-xs text-field-mist/60">
            3D uses a dedicated elevation mesh and shaded-relief skin, not a tilted paper map.
            Contours are generated from DEM. Not lidar.
            {!online ? " 3D needs a network DEM tile." : ""}
          </p>
          <Toggle
            checked={cameraMode !== "flat"}
            onChange={() => setCameraMode(cameraMode === "flat" ? "orbit" : "flat")}
            label="3D orbit"
          />
          <Toggle
            checked={cameraMode === "fpv"}
            onChange={() => {
              if (cameraMode !== "fpv" && useHuntStore.getState().gps.latitude === undefined) {
                openSheet("gps");
                return;
              }
              setCameraMode(cameraMode === "fpv" ? "orbit" : "fpv");
            }}
            label="First person"
          />
        </div>
        {waypoints.length > 0 ? (
          <div>
            <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">MARKS</p>
            <div className="flex flex-wrap gap-1">
              {waypoints.slice(0, 12).map((point) => (
                <button
                  key={point.id}
                  type="button"
                  className={`hud-chip${selectedId === point.id ? " is-live" : ""}`}
                  onClick={() => {
                    useHuntStore.setState({ selectedWaypointId: point.id, sheet: "none" });
                  }}
                >
                  {point.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">KILLS · OBSERVED</p>
          <p className="mb-1 text-xs text-field-observe">
            Your recorded kills only. This is history, not a prediction that animals will be there.
          </p>
          <Toggle checked={layers.kills} onChange={() => toggle("kills")} label="Kill markers" />
          <Toggle checked={layers.killHeat} onChange={() => toggle("killHeat")} label="Kill heat map" />
        </div>
        {(["land", "hunt", "terrain", "camp"] as const).map((group) => (
          <div key={group}>
            <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">{overlayGroupLabel(group)}</p>
            {overlaysForState(hunterState ?? "TX")
              .filter((item) => item.group === group)
              .map((item) => (
                <Toggle
                  key={item.id}
                  checked={layers[item.id]}
                  onChange={() => toggle(item.id)}
                  label={item.label}
                />
              ))}
            {group === "land" ? (
              <p className="mt-1 text-xs text-field-mist/60">
                PAD-US access categories for scouting. TPWD public hunt fill is listed hunt areas only. Not seasons,
                bag limits, or permission.
              </p>
            ) : null}
            {group === "terrain" ? (
              <>
                <Toggle checked={layers.hillshade} onChange={() => toggle("hillshade")} label="Hillshade" />
                <Toggle
                  checked={layers.wireframe}
                  onChange={() => {
                    toggle("wireframe");
                    if (!layers.wireframe && cameraMode === "flat") setCameraMode("orbit");
                  }}
                  label="Wireframe 3D"
                />
                <p className="mt-1 text-xs text-field-mist/60">
                  Lidar is USGS 3DEP hillshade (lidar-derived where available). Wireframe drapes neon isolines on the
                  3D mesh. Not a point cloud.
                </p>
              </>
            ) : null}
          </div>
        ))}
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">INTELLIGENCE</p>
          <p className="mb-1 text-xs text-field-infer">Inferred overlays use a distinct magenta style. Terrain features are sampled DEM, not lidar.</p>
          <Toggle checked={layers.huntScore} onChange={() => toggle("huntScore")} label="Nomad Score" />
          <Toggle checked={layers.terrainFeatures} onChange={() => toggle("terrainFeatures")} label="Terrain features" />
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
  const selectedScore = useHuntStore((state) => state.selectedScore);
  if (sheet !== "property" && sheet !== "intel") return null;
  const feature = result?.features[0];
  const parcel = describeParcelStatus(result?.parcel);
  const regs = result?.publishedRegs;
  const outdoorUrl = regs?.outdoorAnnualUrl ?? stateHuntGuide("TX")?.huntingUrl;
  return (
    <Sheet title={sheet === "intel" ? "LOCATION INTELLIGENCE" : "LAND STATUS"}>
      {coordinate && (
        <p className="mb-2 font-mono text-xs text-field-mist/70">
          {coordinate.lat.toFixed(5)}, {coordinate.lng.toFixed(5)}
        </p>
      )}
      {selectedScore && sheet === "intel" && (
        <div className="mb-3 space-y-2 rounded-xl border border-field-infer/40 p-3 text-sm">
          <TruthBadge layer="inferred" />
          <p className="text-lg">Nomad Score: {selectedScore.score ?? "—"}</p>
          <p>Confidence {Math.round(selectedScore.confidence * 100)}%</p>
          {selectedScore.reasons.length > 0 && (
            <ul className="list-disc pl-4 text-field-mist/80">
              {selectedScore.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {selectedScore.unavailable.length > 0 && (
            <p className="text-field-amber">
              Unavailable: {selectedScore.unavailable.join(", ")}
            </p>
          )}
          <p className="text-xs text-field-mist/70">{selectedScore.disclaimer}</p>
        </div>
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
      <div className="mt-3 space-y-2 rounded-xl border border-field-line p-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-field-mist/60">Parcel</p>
        <p className="text-lg">{parcel.headline}</p>
        <p>{parcel.detail}</p>
      </div>
      <div className="mt-3 space-y-2 rounded-xl border border-field-line p-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-field-mist/60">Legal today</p>
        {regs?.areaName ? <p className="text-lg">{regs.areaName}</p> : null}
        {regs?.muleDeerDrawListed ? (
          <p>
            Listed mule deer draw area. Dates and odds stay on the TPWD drawn-hunt catalog — Nomad does
            not invent them.
          </p>
        ) : null}
        {regs && regs.fields.length > 0 ? (
          <>
            <p className="text-xs text-field-mist/70">
              As published by TPWD · retrieved {new Date(regs.retrievedAt).toLocaleString()}
            </p>
            {regs.fields.map((field) => (
              <p key={field.label}>
                {field.label}: {field.value}
              </p>
            ))}
          </>
        ) : (
          <p>
            Season dates, bag limits, and weapons stay unknown in Nomad unless TPWD published those
            fields on this feature.
          </p>
        )}
        {regs?.drawCatalogUrl ? (
          <a
            className="text-field-amber underline"
            href={regs.drawCatalogUrl}
            target="_blank"
            rel="noreferrer">
            Open drawn-hunt catalog
          </a>
        ) : null}
        {outdoorUrl ? (
          <a className="text-field-amber underline" href={outdoorUrl} target="_blank" rel="noreferrer">
            Open Outdoor Annual
          </a>
        ) : null}
      </div>
    </Sheet>
  );
}

export function WaypointSheet({
  onSave,
}: {
  onSave: (input: {
    type: WaypointType;
    name: string;
    notes: string;
    species?: SpeciesId;
    photos?: string[];
  }) => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const draftType = useHuntStore((state) => state.draftWaypointType);
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  if (sheet !== "waypoint") return null;
  return (
    <Sheet title="NEW WAYPOINT">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const type = (data.get("type") as WaypointType) || draftType;
          const speciesValue = String(data.get("species") || "");
          onSave({
            type,
            name: String(data.get("name") || WAYPOINT_TYPE_LABELS[type]),
            notes: String(data.get("notes") || ""),
            species: SPECIES.includes(speciesValue as SpeciesId)
              ? (speciesValue as SpeciesId)
              : undefined,
            photos: draftPhotos,
          });
          setDraftPhotos([]);
        }}
      >
        <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">
          OBSERVATIONS
        </p>
        <div className="grid grid-cols-3 gap-2">
          {OBSERVATION_WAYPOINT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={draftType === type ? "btn-primary" : "btn-dock"}
              onClick={() => useHuntStore.setState({ draftWaypointType: type })}
            >
              {WAYPOINT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Type
          <select
            name="type"
            value={draftType}
            className="input mt-1"
            onChange={(event) =>
              useHuntStore.setState({
                draftWaypointType: event.target.value as WaypointType,
              })
            }
          >
            {WAYPOINT_TYPES.map((type) => (
              <option key={type} value={type}>
                {WAYPOINT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Name
          <input
            name="name"
            className="input mt-1"
            defaultValue={WAYPOINT_TYPE_LABELS[draftType]}
            key={draftType}
          />
        </label>
        <label className="block text-sm">
          Species
          <select name="species" className="input mt-1" defaultValue="">
            <option value="">Unknown / not specified</option>
            {SPECIES.map((species) => (
              <option key={species} value={species}>
                {SPECIES_LABELS[species]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Notes
          <textarea
            name="notes"
            className="input mt-1"
            rows={3}
            placeholder="Direction of travel, number of animals, freshness…"
          />
        </label>
        {draftPhotos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {draftPhotos.map((uri, index) => (
              <div key={`${uri}-${index}`} className="w-24 shrink-0 space-y-1">
                <img src={uri} alt="" className="h-24 w-24 rounded-lg object-cover" />
                <button
                  type="button"
                  className="btn-dock w-full"
                  onClick={() =>
                    setDraftPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="btn-dock w-full"
          onClick={() => {
            void pickWebWaypointPhoto()
              .then((uri) => {
                if (!uri) return;
                setDraftPhotos((current) => [uri, ...current].slice(0, 6));
              })
              .catch(() => undefined);
          }}
        >
          Add photo
        </button>
        <p className="text-xs text-field-mist/60">
          Saved locally first (private). Uses GPS if available, otherwise the last tap or map center.
        </p>
        <button type="submit" className="btn-primary w-full">
          SAVE OFFLINE
        </button>
      </form>
    </Sheet>
  );
}

export function MarkSheet() {
  const sheet = useHuntStore((state) => state.sheet);
  const mark = useHuntStore((state) =>
    state.waypoints.find((item) => item.id === state.selectedWaypointId),
  );
  const [name, setName] = useState(mark?.name ?? "");
  const [notes, setNotes] = useState(mark?.notes ?? "");
  useEffect(() => {
    setName(mark?.name ?? "");
    setNotes(mark?.notes ?? "");
  }, [mark?.id, mark?.name, mark?.notes]);
  if (sheet !== "mark" || !mark) return null;
  return (
    <Sheet title={WAYPOINT_TYPE_LABELS[mark.type] ?? "WAYPOINT"}>
      <div className="space-y-3 text-sm">
        {mark.photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {mark.photos.map((uri, index) => (
              <div key={`${uri}-${index}`} className="w-24 shrink-0 space-y-1">
                <img src={uri} alt="" className="h-24 w-24 rounded-lg object-cover" />
                <button
                  type="button"
                  className="btn-dock w-full"
                  onClick={() =>
                    void patchWebWaypoint(mark.id, {
                      photos: mark.photos.filter((_, photoIndex) => photoIndex !== index),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="btn-dock w-full"
          onClick={() => {
            void pickWebWaypointPhoto()
              .then((uri) => {
                if (!uri) return;
                return patchWebWaypoint(mark.id, { photos: [uri, ...mark.photos] });
              })
              .catch(() => undefined);
          }}
        >
          Add photo
        </button>
        <label className="block text-sm">
          Name
          <input
            className="input mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void patchWebWaypoint(mark.id, { name })}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            className="input mt-1"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => void patchWebWaypoint(mark.id, { notes })}
          />
        </label>
      </div>
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
            explanation?: { label?: string; score?: number | null; unavailable?: string[] };
          }>;
          overlays?: {
            padusNames: string[];
            huntingUnitLabels: string[];
            publicHuntAreaNames: string[];
            cellsInsidePadus: number;
            cellsInsideHuntAreas: number;
            cellCount: number;
          };
        };
      }
    | undefined;
  if (sheet !== "scout") return null;
  return (
    <Sheet title="AI SCOUT">
      <div className="space-y-3 text-sm">
        <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">WHAT ARE YOU HUNTING?</p>
        <div className="grid grid-cols-2 gap-2">
          {SPECIES.map((species) => (
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
              {SPECIES_LABELS[species]}
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
            {result.explanation.overlays && (
              <div className="space-y-1 text-xs text-field-mist/80">
                <p className="font-mono tracking-[0.2em] text-field-mist/50">OVERLAYS IN VIEW</p>
                <p>
                  PAD-US:{" "}
                  {result.explanation.overlays.padusNames.length
                    ? `${result.explanation.overlays.padusNames.join(", ")} (${result.explanation.overlays.cellsInsidePadus}/${result.explanation.overlays.cellCount} cells)`
                    : "no fee polygon on scored cells (unknown, not private)"}
                </p>
                <p>
                  TPWD DMU:{" "}
                  {result.explanation.overlays.huntingUnitLabels.length
                    ? result.explanation.overlays.huntingUnitLabels.join(", ")
                    : "none on scored cells"}
                </p>
                <p>
                  TPWD hunt areas:{" "}
                  {result.explanation.overlays.publicHuntAreaNames.length
                    ? result.explanation.overlays.publicHuntAreaNames.join(", ")
                    : "none on scored cells"}
                </p>
                <p className="text-field-amber">
                  Overlays are GIS layers, not posted signs, seasons, or permission.
                </p>
              </div>
            )}
            {result.explanation.setups.map((setup, index) => (
              <div key={index} className="border-t border-field-line pt-2">
                <p>
                  {setup.explanation?.label ?? "Nomad Score"} {index + 1} —{" "}
                  {setup.explanation?.score ?? setup.scores.overall ?? "—"}/100
                </p>
                <p className="text-field-mist/70">{setup.reasons.join(" · ")}</p>
                {setup.explanation?.unavailable && setup.explanation.unavailable.length > 0 && (
                  <p className="text-field-amber">
                    Unavailable: {setup.explanation.unavailable.join(", ")}
                  </p>
                )}
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

export function TerrainSheet({
  onAnalyze,
}: {
  onAnalyze: () => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const result = useHuntStore((state) => state.terrainResult);
  if (sheet !== "terrain") return null;
  const features = result?.features ?? [];
  return (
    <Sheet title="ANALYZE TERRAIN">
      <div className="space-y-2 text-sm">
        <TruthBadge layer="inferred" />
        <p>
          Terrain features are inferred from sampled elevations, not a lidar DEM. Confirm on the
          ground.
        </p>
        <button type="button" className="btn-primary w-full" onClick={onAnalyze}>
          ANALYZE VISIBLE MAP
        </button>
        {features.length === 0 ? (
          <p className="text-field-mist/70">
            Missing elevation stays unknown — nothing is invented.
          </p>
        ) : (
          features.slice(0, 12).map((feature, index) => (
            <div key={`${feature.kind}-${index}`} className="border-t border-field-line pt-2">
              <p>
                {feature.label} · {Math.round(feature.confidence * 100)}%
              </p>
              <p className="text-field-mist/70">{feature.reasons.join(" · ")}</p>
            </div>
          ))
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

export function KillSheet({
  onDrop,
}: {
  onDrop: (species: SpeciesId) => void;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const species = useHuntStore((state) => state.draftKillSpecies);
  const waypoints = useHuntStore((state) => state.waypoints);
  const gps = useHuntStore((state) => state.gps);
  const mapBounds = useHuntStore((state) => state.mapBounds);
  const layers = useHuntStore((state) => state.layers);
  if (sheet !== "kill") return null;
  const kills = recordedKills(waypoints);
  const cells = harvestHeatmap(harvestLocations(waypoints));
  const hasGps = gps.latitude !== undefined && gps.longitude !== undefined;
  const hasMap = Boolean(mapBounds);
  const locationLabel = hasGps
    ? "GPS fix"
    : hasMap
      ? "map center"
      : "default field center";
  return (
    <Sheet title="KILL MARKER">
      <div className="space-y-3 text-sm">
        <TruthBadge layer="observed" />
        <p>
          Drop a private kill at your {locationLabel}. Red targets and the warm blob are your recorded
          kills only — not a forecast.
        </p>
        <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">SPECIES</p>
        <div className="grid grid-cols-2 gap-2">
          {SPECIES.map((id) => (
            <button
              key={id}
              type="button"
              className={species === id ? "btn-kill" : "btn-dock"}
              onClick={() => useHuntStore.setState({ draftKillSpecies: id })}
            >
              {SPECIES_LABELS[id]}
            </button>
          ))}
        </div>
        <button type="button" className="btn-kill w-full" onClick={() => onDrop(species)}>
          DROP KILL
        </button>
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.kills}
              onChange={() =>
                useHuntStore.setState({ layers: { ...layers, kills: !layers.kills } })
              }
            />
            Show markers
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.killHeat}
              onChange={() =>
                useHuntStore.setState({ layers: { ...layers, killHeat: !layers.killHeat } })
              }
            />
            Show heat map
          </label>
        </div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">
          {kills.length} RECORDED · {cells.length} HEAT {cells.length === 1 ? "CELL" : "CELLS"}
        </p>
        {kills.length === 0 ? (
          <p className="text-field-mist/70">No kills marked yet. Future drops will stack on the heat map.</p>
        ) : (
          <ul className="space-y-2">
            {kills.map((kill) => (
              <li key={kill.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-field-line px-3 py-2 text-left"
                  onClick={() =>
                    flyToBounds(
                      kill.id,
                      {
                        west: kill.longitude - 0.01,
                        south: kill.latitude - 0.01,
                        east: kill.longitude + 0.01,
                        north: kill.latitude + 0.01,
                      },
                      { latitude: kill.latitude, longitude: kill.longitude },
                    )
                  }
                >
                  <p className="font-mono text-xs text-field-danger">
                    {kill.species ? SPECIES_LABELS[kill.species] : "Kill"}
                  </p>
                  <p className="text-xs text-field-mist/70">
                    {new Date(kill.observedAt ?? kill.createdAt).toLocaleString()} ·{" "}
                    {kill.latitude.toFixed(4)}, {kill.longitude.toFixed(4)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
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
                flyToBounds(place.id, place.bounds, place.center);
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
        <Readout label="ALT" value={gps.altitude !== undefined ? formatLengthFeet(gps.altitude) : "—"} />
        <Readout label="ACC" value={gps.accuracy !== undefined ? formatLengthFeet(gps.accuracy) : "—"} />
        <Readout label="HDG" value={gps.heading !== undefined ? `${Math.round(gps.heading)}°` : "—"} />
        <Readout label="SPD" value={gps.speed !== undefined ? formatSpeedMph(gps.speed) : "—"} />
      </div>
      <p className="mt-2 text-xs text-field-mist/60">Source: {gps.source}. Errors: {gps.error ?? "none"}</p>
      {weather && (
        <p className="mt-2 text-sm">
          {formatTemperatureF(weather.temperatureC ?? Number.NaN)} · wind{" "}
          {weather.windDirectionFromDegrees ?? "—"}° at {formatSpeedMph(weather.windSpeedMps ?? Number.NaN)}
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

export function AccountSheet({
  onLogin,
  onRegister,
  onLogout,
  onDownloadPack,
  error,
}: {
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  onLogout: () => void;
  onDownloadPack: () => void;
  error?: string;
}) {
  const sheet = useHuntStore((state) => state.sheet);
  const account = useHuntStore((state) => state.account);
  if (sheet !== "account") return null;
  return (
    <Sheet title="ACCOUNT">
      <HomeStateBlock onDownloadPack={onDownloadPack} />
      {account ? (
        <div className="mt-4 space-y-3 text-sm">
          <p>Signed in as {account.email}</p>
          <p className="text-field-mist/70">
            Server sync is on. Stands, cameras, harvests, and tracks stay private unless you change that later.
          </p>
          <button type="button" className="btn-primary w-full" onClick={onLogout}>
            SIGN OUT
          </button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onLogin(String(data.get("email") || ""), String(data.get("password") || ""));
          }}
        >
          <p className="text-sm text-field-mist/70">
            Field marks work offline without an account. Sign in to persist them on the server.
          </p>
          <input name="email" type="email" className="input" placeholder="you@example.com" required />
          <input
            name="password"
            type="password"
            className="input"
            placeholder="10+ chars with a number"
            required
          />
          {error && <p className="text-sm text-field-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            SIGN IN
          </button>
          <button
            type="button"
            className="btn-dock w-full"
            onClick={(event) => {
              const form = (event.currentTarget as HTMLButtonElement).form;
              if (!form) return;
              const data = new FormData(form);
              onRegister(String(data.get("email") || ""), String(data.get("password") || ""));
            }}
          >
            CREATE ACCOUNT
          </button>
        </form>
      )}
    </Sheet>
  );
}

function HomeStateBlock({ onDownloadPack }: { onDownloadPack: () => void }) {
  const hunterState = useHuntStore((state) => state.hunterState);
  const packSelection = useHuntStore((state) => state.packSelection);
  const packStatus = useHuntStore((state) => state.packStatus);
  const packCachedIds = useHuntStore((state) => state.packCachedIds);
  const packLastDownloaded = useHuntStore((state) => state.packLastDownloaded);
  const [query, setQuery] = useState("");
  const selected = STATE_HUNT_GUIDES.find((item) => item.code === hunterState);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return STATE_HUNT_GUIDES;
    return STATE_HUNT_GUIDES.filter(
      (item) =>
        item.code.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle),
    );
  }, [query]);
  const available = overlaysForState(hunterState);
  const extent = packExtentForState(hunterState);
  const checked = sanitizePackSelection(hunterState, packSelection);
  const estimate = extent ? estimateOverlayPack(extent, checked) : undefined;
  const mb = estimate ? Math.max(1, Math.round(estimate.estimatedBytes / 1_000_000)) : 0;

  return (
    <div className="space-y-3 text-sm">
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-field-amber/50 bg-black/30 p-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-field-amber bg-field-ink font-mono text-2xl font-bold tracking-[0.12em] text-field-amber">
            {selected.code}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] text-field-amber">HOME</p>
            <p className="truncate text-lg text-field-mist">{selected.name}</p>
            <p className="truncate text-xs text-field-mist/60">{selected.agency}</p>
          </div>
        </div>
      ) : (
        <p className="text-field-mist/70">Pick the state you hunt. Overlay packs and agency rules follow that home state.</p>
      )}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="input"
        placeholder="Search states"
      />
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {matches.map((item) => {
          const on = hunterState === item.code;
          return (
            <button
              key={item.code}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                on ? "border-field-amber bg-field-amber/15" : "border-field-line bg-black/20"
              }`}
              onClick={() => {
                setHunterState(item.code);
              }}
            >
              <span className="w-8 font-mono text-sm text-field-amber">{item.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.name}</span>
                <span className="block truncate text-[11px] text-field-mist/50">{item.agency}</span>
              </span>
              {on ? <span className="font-mono text-[10px] text-field-amber">●</span> : null}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="space-y-2 rounded-2xl border border-field-line p-3">
          <p className="font-mono text-[10px] tracking-[0.2em] text-field-mist/50">FIELD PACK</p>
          {!extent ? (
            <p className="text-xs text-field-mist/70">
              Statewide overlay packs are Texas-first. National layers still display on the map.
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPackSelection(available.map((item) => item.id))}
                >
                  SELECT ALL
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPackSelection([])}
                >
                  NONE
                </button>
              </div>
              {available.map((item) => {
                const on = checked.includes(item.id);
                const ready = packCachedIds.includes(item.id);
                return (
                  <label key={item.id} className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = on
                          ? checked.filter((id) => id !== item.id)
                          : [...checked, item.id];
                        setPackSelection(next);
                      }}
                    />
                    <span>{item.label}</span>
                    {ready ? <span className="ml-auto font-mono text-[10px] text-field-moss">READY</span> : null}
                  </label>
                );
              })}
              <p className="text-xs text-field-mist/60">
                ~{mb} MB · z{estimate?.minZoom}–{estimate?.maxZoom} raster for dense layers. Not seasons, fences, or
                permission.
              </p>
              {packStatus ? (
                <p className="font-mono text-xs">
                  {packStatus.label} {packStatus.done}/{packStatus.total}
                </p>
              ) : null}
              {packLastDownloaded ? (
                <p className="text-[11px] text-field-mist/50">Last cached {packLastDownloaded}</p>
              ) : null}
              <button type="button" className="btn-primary w-full" onClick={onDownloadPack} disabled={checked.length === 0}>
                DOWNLOAD SELECTED
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function toDdm(value: number, pos: string, neg: string): string {
  const hemi = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minutes = (abs - deg) * 60;
  return `${deg}°${minutes.toFixed(2)}'${hemi}`;
}

function neraMetricCell(
  style: NeraStyle,
  scaleMeters: number,
  speed?: number,
): ReactNode {
  switch (style) {
    case "wire":
      return (
        <p>
          <span>SCALE</span>
          <strong>{scaleMeters} m</strong>
        </p>
      );
    case "glass":
      return (
        <p>
          <span>SPD</span>
          <strong>{speed != null ? formatSpeedMph(speed) : "—"}</strong>
        </p>
      );
    default: {
      const _exhausted: never = style;
      return _exhausted;
    }
  }
}

function neraHudKicker(style: NeraStyle): string {
  switch (style) {
    case "glass":
      return "NERA AI · HUNT / NAV";
    case "wire":
      return "NERA WIRE · HUNT / NAV";
    default: {
      const _exhausted: never = style;
      return _exhausted;
    }
  }
}

function gpsLockLabel(source: "gps" | "operator" | "none", accuracy?: number, lat?: number, lng?: number): string {
  if (source === "none" || lat === undefined || lng === undefined) return "NO FIX";
  if (source === "operator") return "MAP";
  if (typeof accuracy !== "number") return "LOCK";
  if (accuracy <= 8) return "LOCK";
  if (accuracy <= 25) return "TRACK";
  return "DEGRADED";
}

function NeraAiPanel() {
  const gps = useHuntStore((state) => state.gps);
  const weather = useHuntStore((state) => state.weather);
  const elevation = useHuntStore((state) => state.terrainElevationMeters);
  const selectedId = useHuntStore((state) => state.selectedWaypointId);
  const mark = useHuntStore((state) => state.waypoints.find((item) => item.id === state.selectedWaypointId));
  const features = useHuntStore((state) => state.terrainResult?.features) ?? EMPTY_TERRAIN_FEATURES;
  const neraStyle = useHuntStore((state) => state.neraStyle);
  const mapBounds = useHuntStore((state) => state.mapBounds);
  const gpsRingIntel = useHuntStore((state) => state.gpsRingIntel);
  const heading =
    typeof gps.heading === "number" && Number.isFinite(gps.heading) ? Math.round(gps.heading) : null;
  const lock = gpsLockLabel(gps.source, gps.accuracy, gps.latitude, gps.longitude);
  const yards =
    mark && gps.latitude !== undefined && gps.longitude !== undefined
      ? Math.round(haversineMeters({ latitude: gps.latitude, longitude: gps.longitude }, mark) / 0.9144)
      : null;
  const bearing =
    mark && gps.latitude !== undefined && gps.longitude !== undefined
      ? formatBearing(initialBearingDegrees({ latitude: gps.latitude, longitude: gps.longitude }, mark))
      : null;
  const intel = features.slice(0, 3).map((item) => item.label);
  const elevRead =
    elevation != null
      ? formatLengthFeet(elevation)
      : gps.altitude != null
        ? formatLengthFeet(gps.altitude)
        : "—";
  const scaleMeters = neraGridSpacingMeters(zoomFromBounds(mapBounds));
  const ringLine = gpsRingHudLine(gpsRingIntel);
  return (
    <aside className="nera-ai">
      <div className="nera-ai-head">
        <p className="nera-ai-kicker">{neraHudKicker(neraStyle)}</p>
        <p className="nera-ai-lock">{lock}</p>
      </div>
      <p className="nera-ai-fix">
        {gps.latitude !== undefined && gps.longitude !== undefined
          ? `${toDdm(gps.latitude, "N", "S")}  ${toDdm(gps.longitude, "E", "W")}`
          : "Awaiting high-end GPS"}
      </p>
      <div className="nera-ai-grid">
        <p>
          <span>HDG</span>
          <strong>{heading != null ? `${heading}°` : "—"}</strong>
        </p>
        <p>
          <span>ELV</span>
          <strong>{elevRead}</strong>
        </p>
        <p>
          <span>CEP</span>
          <strong>{typeof gps.accuracy === "number" ? `±${formatLengthFeet(gps.accuracy)}` : "—"}</strong>
        </p>
        {neraMetricCell(neraStyle, scaleMeters, gps.speed)}
      </div>
      <p className="nera-ai-nav">
        {mark && selectedId
          ? `NAV ${yards ?? "—"} yd ${bearing ?? ""} · ${mark.name}`
          : "NAV — mark a pin to vector"}
      </p>
      {ringLine ? <p className="nera-ai-intel">{ringLine}</p> : null}
      <p className="nera-ai-intel">
        {intel.length > 0 ? `INTEL ${intel.join(" · ")}` : "INTEL scanning sampled DEM"}
      </p>
      <p className="nera-ai-wx">
        {weather
          ? `WX ${formatTemperatureF(weather.temperatureC ?? Number.NaN)} · wind ${weather.windDirectionFromDegrees ?? "—"}°`
          : "WX —"}
      </p>
      <p className="nera-ai-note">Next-gen hunt / nav · inferred, not lidar</p>
    </aside>
  );
}

export function TerrainHud({ onScan }: { onScan?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const cameraMode = useHuntStore((state) => state.cameraMode);
  const mapTheme = useHuntStore((state) => state.mapTheme);
  const neraMode = useHuntStore((state) => state.neraMode);
  const neraStyle = useHuntStore((state) => state.neraStyle);
  const exaggeration = useHuntStore((state) => state.terrainExaggeration);
  const elevation = useHuntStore((state) => state.terrainElevationMeters);
  const gps = useHuntStore((state) => state.gps);
  const online = useHuntStore((state) => state.online);
  const followGps = useHuntStore((state) => state.followGps);
  const fpvHeadingLock = useHuntStore((state) => state.fpvHeadingLock);
  const gpsRingIntel = useHuntStore((state) => state.gpsRingIntel);
  const heading =
    typeof gps.heading === "number" && Number.isFinite(gps.heading) ? Math.round(gps.heading) : null;
  useEffect(() => {
    setMounted(true);
  }, []);
  const ringLine = gpsRingHudLine(gpsRingIntel);
  const hudSkin = [
    "terrain-hud",
    neraMode ? "is-nera" : "",
    neraMode && neraStyle === "wire" ? "is-wire" : "",
    !neraMode && mapTheme === "light" ? "is-light" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={hudSkin}>
      <div className="hud-cluster">
        <button
          type="button"
          className={`hud-icon${cameraMode === "flat" ? " is-live" : ""}`}
          onClick={() => setCameraMode("flat")}
        >
          2D
        </button>
        <button
          type="button"
          className={`hud-icon${cameraMode === "orbit" ? " is-live" : ""}`}
          onClick={() => setCameraMode(cameraMode === "orbit" ? "flat" : "orbit")}
        >
          3D
        </button>
        <button
          type="button"
          className={`hud-icon${cameraMode === "fpv" ? " is-live" : ""}`}
          onClick={() => {
            if (gps.latitude === undefined) {
              openSheet("gps");
              return;
            }
            setCameraMode(cameraMode === "fpv" ? "orbit" : "fpv");
          }}
        >
          FPV
        </button>
        <button
          type="button"
          className="hud-icon"
          onClick={() => {
            onScan?.();
            openSheet("terrain");
          }}
        >
          Scan
        </button>
      </div>
      {cameraMode !== "flat" ? (
        <>
          <div className="hud-cluster">
            <button
              type="button"
              className={`hud-icon${mapTheme === "dark" ? " is-live" : ""}`}
              onClick={() => setMapTheme("dark")}
            >
              Dark
            </button>
            <button
              type="button"
              className={`hud-icon${mapTheme === "light" ? " is-live" : ""}`}
              onClick={() => setMapTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={`hud-icon${neraMode ? " is-live" : ""}`}
              onClick={() => setNeraMode(!neraMode)}
            >
              Nera
            </button>
          </div>
          {neraMode ? (
            <div className="hud-cluster">
              <button
                type="button"
                className={`hud-icon${neraStyle === "glass" ? " is-live" : ""}`}
                onClick={() => setNeraStyle("glass")}
              >
                Glass
              </button>
              <button
                type="button"
                className={`hud-icon${neraStyle === "wire" ? " is-live" : ""}`}
                onClick={() => setNeraStyle("wire")}
              >
                Wire
              </button>
            </div>
          ) : null}
          {neraMode ? <NeraAiPanel /> : null}
          <label className="terrain-hud-exag">
            EXAG {exaggeration.toFixed(1)}×
            <input
              type="range"
              min={MIN_TERRAIN_EXAGGERATION}
              max={MAX_TERRAIN_EXAGGERATION}
              step={0.1}
              value={exaggeration}
              onChange={(event) =>
                useHuntStore.setState({
                  terrainExaggeration: clampExaggeration(Number(event.target.value)),
                })
              }
            />
          </label>
          <p className="terrain-hud-read">
            {heading != null ? `${heading}°` : "—"} ·{" "}
            {elevation != null ? formatLengthFeet(elevation) : gps.altitude != null ? formatLengthFeet(gps.altitude) : "—"}
            {mounted && followGps ? " · LIVE" : ""}
            {mounted && !online ? " · DEM offline" : ""}
            {ringLine ? ` · ${ringLine}` : ""}
          </p>
          {cameraMode === "fpv" && !fpvHeadingLock ? (
            <button
              type="button"
              className="hud-icon"
              onClick={() => useHuntStore.setState({ fpvHeadingLock: true, followGps: true })}
            >
              Recenter
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function FieldExtras() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto absolute left-3 top-24 z-20 flex flex-col items-start gap-1">
      <button type="button" className={`hud-icon${open ? " is-live" : ""}`} onClick={() => setOpen((value) => !value)}>
        Tools
      </button>
      {open ? (
        <div className="flex flex-col gap-1">
          <button type="button" className="hud-chip" onClick={() => openSheet("download")}>
            Download
          </button>
          <button type="button" className="hud-chip" onClick={() => openSheet("areas")}>
            Areas
          </button>
          <Link className="hud-chip text-center" href="/admin">
            Health
          </Link>
          <Link className="hud-chip text-center" href="/privacy">
            Privacy
          </Link>
        </div>
      ) : null}
    </div>
  );
}
