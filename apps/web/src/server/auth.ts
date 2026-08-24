import { randomBytes } from "node:crypto";
import { assertCredentials, normalizeEmail } from "@huntos/core";
import { isProduction, sessionTtlMs } from "./env";
import { hashPassword, verifyPassword } from "./passwords";
import {
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  findUserById,
  getSession,
  type StoredUser,
} from "./store";

export const SESSION_COOKIE = "huntos_session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    maxAge: Math.floor(sessionTtlMs() / 1000),
  };
}

export async function registerAccount(
  email: string,
  password: string,
): Promise<StoredUser> {
  const error = assertCredentials(email, password);
  if (error) throw new Error(error);
  const normalized = normalizeEmail(email);
  const { salt, hash } = hashPassword(password);
  return createUser({
    id: randomBytes(16).toString("hex"),
    email: normalized,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  });
}

export async function loginAccount(
  email: string,
  password: string,
): Promise<StoredUser> {
  const user = await findUserByEmail(normalizeEmail(email));
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error("Email or password is incorrect.");
  }
  return user;
}

export async function issueSession(userId: string): Promise<string> {
  const id = randomBytes(32).toString("hex");
  await createSession({
    id,
    userId,
    expiresAt: new Date(Date.now() + sessionTtlMs()).toISOString(),
  });
  return id;
}

export async function userFromRequest(
  request: Request,
): Promise<StoredUser | undefined> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const sessionId = match?.slice(SESSION_COOKIE.length + 1);
  if (!sessionId) return undefined;
  const session = await getSession(sessionId);
  if (!session) return undefined;
  return findUserById(session.userId);
}

export async function revokeSession(request: Request): Promise<void> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const sessionId = match?.slice(SESSION_COOKIE.length + 1);
  if (sessionId) await deleteSession(sessionId);
}

export function publicUser(user: StoredUser) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
