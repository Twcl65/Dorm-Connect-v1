import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

/** Register (upsert) an Expo push token for the authenticated user. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { token?: string };
    const token = (body.token ?? "").trim();
    if (!token || !token.startsWith("ExponentPushToken[")) {
      return NextResponse.json(
        { error: "Invalid Expo push token." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await pool.query(
      `INSERT INTO public.push_tokens (user_id, token)
       VALUES ($1::uuid, $2)
       ON CONFLICT (user_id, token)
       DO UPDATE SET updated_at = now()`,
      [session.sub, token]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save push token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Unregister a push token (e.g. on sign-out). */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { token?: string };
    const token = (body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Token required." }, { status: 400 });
    }

    const pool = await getPool();
    await pool.query(
      `DELETE FROM public.push_tokens
       WHERE user_id = $1::uuid AND token = $2`,
      [session.sub, token]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to remove push token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
