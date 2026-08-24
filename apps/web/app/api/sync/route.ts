import { NextResponse } from "next/server";
import type { Waypoint } from "@huntos/core";
import { listWaypoints, replaceAll, upsertWaypoint } from "@/server/sync-store";

function userIdFrom(request: Request): string {
  return request.headers.get("x-huntos-user") || "local-anonymous";
}

export async function GET(request: Request) {
  const userId = userIdFrom(request);
  return NextResponse.json({ waypoints: listWaypoints(userId) });
}

export async function POST(request: Request) {
  const userId = userIdFrom(request);
  const body = (await request.json()) as {
    waypoints?: Waypoint[];
    waypoint?: Waypoint;
  };
  if (body.waypoint) {
    return NextResponse.json({ waypoint: upsertWaypoint(userId, body.waypoint) });
  }
  if (body.waypoints) {
    return NextResponse.json({ waypoints: replaceAll(userId, body.waypoints) });
  }
  return NextResponse.json({ error: "No waypoint payload." }, { status: 400 });
}
