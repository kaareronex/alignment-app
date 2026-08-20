import "server-only";
import { cookies } from "next/headers";

function cookieName(projectId: string) {
  return `interview_session_${projectId}`;
}

/** Only callable from Server Actions/Route Handlers. */
export async function setInterviewSessionCookie(
  projectId: string,
  sessionId: string
) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(projectId), sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/interview/${projectId}`,
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/** Read-only. Safe to call from Server Components. */
export async function getInterviewSessionId(
  projectId: string
): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName(projectId))?.value ?? null;
}
