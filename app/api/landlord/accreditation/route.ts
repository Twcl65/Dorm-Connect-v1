import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureLandlordProperty, landlordLog } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      dorm_name: string;
      address: string;
      documents_count: number;
      submitted_at: Date;
      status: string;
    }>(
      `SELECT id, dorm_name, address, documents_count, submitted_at, status
       FROM public.landlord_accreditation_requests
       WHERE owner_user_id = $1::uuid
       ORDER BY submitted_at DESC`,
      [ownerId]
    );

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        dormName: r.dorm_name,
        address: r.address,
        documentsCount: r.documents_count,
        submittedDate: new Date(r.submitted_at).toISOString().slice(0, 10),
        status: r.status as
          | "Submitted"
          | "In Review"
          | "Approved"
          | "Rejected"
          | "Needs Documents",
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      dormName?: string;
      address?: string;
      documentsCount?: number;
      formData?: Record<string, unknown>;
    };
    const dormName = (body.dormName ?? "").trim();
    const address = (body.address ?? "").trim();
    if (!dormName || !address) {
      return NextResponse.json(
        { error: "Dorm name and address are required." },
        { status: 400 }
      );
    }
    const documentsCount = Math.max(0, Number(body.documentsCount) || 0);
    const formData = body.formData ?? {};

    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_accreditation_requests
        (owner_user_id, property_id, dorm_name, address, documents_count, form_data, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, 'Submitted')
       RETURNING id`,
      [ownerId, propertyId, dormName, address, documentsCount, JSON.stringify(formData)]
    );

    await landlordLog(
      pool,
      ownerId,
      `Submitted accreditation: ${dormName}`
    );
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
