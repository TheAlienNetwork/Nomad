import { NextResponse } from "next/server";
import type { Waypoint } from "@huntos/core";
import { userFromRequest } from "@/server/auth";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { listWaypoints, replaceWaypoints, upsertWaypoint } from "@/server/store";

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to sync. Field marks stay on this device until then." },
      { status: 401 },
    );
  }
  return NextResponse.json({ waypoints: await listWaypoints(user.id) });
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "sync"), 40, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Sync rate limited." }, { status: 429 });
  }
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to sync. Offline marks were not discarded." },
      { status: 401 },
    );
  }
  const body = (await request.json()) as {
    waypoints?: Waypoint[];
    waypoint?: Waypoint;
  };
  try {
    if (body.waypoint) {
      return NextResponse.json({
        waypoint: await upsertWaypoint(user.id, body.waypoint),
      });
    }
    if (body.waypoints) {
      return NextResponse.json({
        waypoints: await replaceWaypoints(user.id, body.waypoints),
      });
    }
    return NextResponse.json({ error: "No waypoint payload." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 400 },
    );
  }
}
