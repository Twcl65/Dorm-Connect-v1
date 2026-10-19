import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const OPS = ["Operating", "Not Operating", "Under Inspection"] as const;
const COMP = ["Compliant", "Warning", "Non-Compliant"] as const;

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      operationalStatus?: string;
      complianceStatus?: string;
      lastInspectionAt?: string | null;
    };
    const pool = await getPool();

    const { rows: exists } = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.landlord_properties p
         WHERE p.id = $1::uuid
           AND EXISTS (
             SELECT 1 FROM public.landlord_accreditation_requests a
             WHERE a.property_id = p.id AND a.status = 'Approved'
           )
       ) AS ok`,
      [id]
    );
    if (!exists[0]?.ok) {
      return NextResponse.json(
        { error: "Property not found or not accredited." },
        { status: 404 }
      );
    }

    const op = body.operationalStatus;
    const comp = body.complianceStatus;
    const opOk = op != null && (OPS as readonly string[]).includes(op);
    const compOk = comp != null && (COMP as readonly string[]).includes(comp);

    if (!opOk && !compOk && body.lastInspectionAt === undefined) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    if (opOk) {
      await pool.query(
        `UPDATE public.landlord_properties
         SET operational_status = $2, updated_at = now()
         WHERE id = $1::uuid`,
        [id, op]
      );
    }
    if (compOk) {
      await pool.query(
        `UPDATE public.landlord_properties
         SET compliance_status = $2, updated_at = now()
         WHERE id = $1::uuid`,
        [id, comp]
      );
    }
    if (body.lastInspectionAt !== undefined) {
      const v = body.lastInspectionAt;
      const dateVal =
        v == null || v === ""
          ? null
          : /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)
            ? v
            : null;
      if (v != null && v !== "" && dateVal === null) {
        return NextResponse.json(
          { error: "lastInspectionAt must be YYYY-MM-DD or empty." },
          { status: 400 }
        );
      }
      await pool.query(
        `UPDATE public.landlord_properties
         SET last_inspection_at = $2::date, updated_at = now()
         WHERE id = $1::uuid`,
        [id, dateVal]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
