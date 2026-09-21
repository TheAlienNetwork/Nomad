import { NextResponse } from "next/server";
import { publicUser, userFromRequest } from "@/server/auth";

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: publicUser(user) });
}
