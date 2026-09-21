import { NextResponse } from "next/server";
import {
  issueSession,
  publicUser,
  registerAccount,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/server/auth";
import { clientKey, rateLimit } from "@/server/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "register"), 8, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  const body = (await request.json()) as { email?: string; password?: string };
  try {
    const user = await registerAccount(body.email ?? "", body.password ?? "");
    const sessionId = await issueSession(user.id);
    const response = NextResponse.json({ user: publicUser(user) });
    response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed." },
      { status: 400 },
    );
  }
}
