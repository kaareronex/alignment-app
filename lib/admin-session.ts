import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encodedKey = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET!);

export type AdminSessionPayload = {
  role: "admin";
};

async function encryptAdminSession(payload: AdminSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(encodedKey);
}

export async function decryptAdminSession(
  token: string | undefined
): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    if (payload.role !== "admin") return null;
    return { role: "admin" };
  } catch {
    return null;
  }
}

/** Read-only session check. Safe to call from Server Components. */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  return decryptAdminSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

/** Redirects to the login page if there's no valid session. */
export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

/** Sets the session cookie. Only callable from Server Actions/Route Handlers. */
export async function createAdminSessionCookie() {
  const token = await encryptAdminSession({ role: "admin" });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clears the session cookie. Only callable from Server Actions/Route Handlers. */
export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
