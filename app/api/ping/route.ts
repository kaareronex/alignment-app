import { NextResponse } from "next/server";

// Deliberately does nothing but respond - no auth, no DB, no AI call - so the
// readiness-check screen can measure raw network round-trip time and jitter
// without any of that other latency muddying the reading.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true });
}
