import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getLandlordGcashForStudentReservation } from "@/lib/landlord-gcash";
import { requireStudent } from "@/lib/require-student";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const reservationId = new URL(req.url).searchParams.get("reservationId");
  if (!reservationId || !/^[0-9a-f-]{36}$/i.test(reservationId)) {
    return NextResponse.json({ error: "reservationId required." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const details = await getLandlordGcashForStudentReservation(
      pool,
      reservationId,
      session.sub
    );
    if (!details) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load GCash details";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
