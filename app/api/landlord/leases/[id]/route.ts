import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      tenantName?: string;
      leaseStart?: string;
      leaseEnd?: string;
      paymentStatus?: string;
      email?: string;
      phone?: string;
    };

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      tenant_name: string;
      lease_start: string;
      lease_end: string;
      payment_status: string;
      email: string | null;
      phone: string | null;
    }>(
      `SELECT tenant_name, lease_start::text, lease_end::text, payment_status, email, phone
       FROM public.landlord_tenant_leases
       WHERE owner_user_id = $1::uuid AND id = $2::uuid`,
      [ownerId, id]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const c = cur[0];
    const tenantName = (body.tenantName ?? c.tenant_name).trim();
    const leaseStart = body.leaseStart ?? c.lease_start.slice(0, 10);
    const leaseEnd = body.leaseEnd ?? c.lease_end.slice(0, 10);
    let paymentStatus = c.payment_status;
    if (
      body.paymentStatus === "Paid" ||
      body.paymentStatus === "Pending" ||
      body.paymentStatus === "Overdue"
    ) {
      paymentStatus = body.paymentStatus;
    }
    const email =
      body.email !== undefined ? body.email.trim() || null : c.email;
    const phone =
      body.phone !== undefined ? body.phone.trim() || null : c.phone;

    await pool.query(
      `UPDATE public.landlord_tenant_leases SET
        tenant_name = $1,
        lease_start = $2::date,
        lease_end = $3::date,
        payment_status = $4,
        email = $5,
        phone = $6,
        updated_at = now()
       WHERE owner_user_id = $7::uuid AND id = $8::uuid`,
      [
        tenantName,
        leaseStart,
        leaseEnd,
        paymentStatus,
        email,
        phone,
        ownerId,
        id,
      ]
    );
    await landlordLog(pool, ownerId, `Updated tenant lease ${tenantName}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
