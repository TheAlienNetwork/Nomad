import type { Waypoint } from "@huntos/core";
import { saveWaypoint } from "@/lib/offline";
import { useHuntStore } from "@/lib/store";

const MAX_WIDTH = 512;
const MAX_PIN_PHOTOS = 6;

export async function prepareWebWaypointPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that photo.");
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function pickWebWaypointPhoto(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void prepareWebWaypointPhoto(file).then(resolve).catch(reject);
    };
    input.click();
  });
}

export async function patchWebWaypoint(
  id: string,
  patch: Partial<Pick<Waypoint, "name" | "notes" | "photos" | "type" | "species">>,
): Promise<void> {
  const current = useHuntStore.getState();
  const existing = current.waypoints.find((item) => item.id === id);
  if (!existing) return;
  const now = new Date().toISOString();
  const next: Waypoint = {
    ...existing,
    ...patch,
    photos: (patch.photos ?? existing.photos).slice(0, MAX_PIN_PHOTOS),
    updatedAt: now,
    version: existing.version + 1,
    syncStatus: "pending",
  };
  await saveWaypoint(next);
  useHuntStore.setState({
    waypoints: current.waypoints.map((item) => (item.id === id ? next : item)),
  });
}

export async function attachWebWaypointPhoto(id: string): Promise<void> {
  const uri = await pickWebWaypointPhoto();
  if (!uri) return;
  const existing = useHuntStore.getState().waypoints.find((item) => item.id === id);
  if (!existing) return;
  await patchWebWaypoint(id, { photos: [uri, ...existing.photos] });
}
