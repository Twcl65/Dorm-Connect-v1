import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin, requireOsaStaff } from "@/lib/require-osa";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

const ACC_STATUSES = new Set([
  "Pending",
  "Scheduled for Inspection",
  "Recommended for Approval",
  "Hold",
  "Rejected",
  "Approved",
  "Expired",
]);

type Ctx = { params: { id: string } };

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function GET(_req: Request, context: Ctx) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      dorm_name: string;
      address: string;
      status: string;
      documents_count: number;
      submitted_at: Date;
      updated_at: Date;
      form_data: unknown;
      owner_name: string;
      owner_email: string;
      owner_user_id: string;
      inspection_scheduled_for: string | null;
      accreditation_expires_at: Date | null;
            property_id: string | null;
      landlord_name: string | null;
      landlord_location: string | null;
            property_city: string | null;
            property_type: string | null;
            property_description: string | null;
            contact_phone: string | null;
            contact_email: string | null;
            total_rooms: number | null;
            max_occupancy_capacity: number | null;
            cover_image_url: string | null;
            gallery_image_urls: unknown;
    }>(
      `SELECT a.id, a.dorm_name, a.address, a.status, a.documents_count, a.submitted_at, a.updated_at, a.form_data,
              a.owner_user_id, a.property_id, a.inspection_scheduled_for::text, a.accreditation_expires_at,
              u.full_name AS owner_name, u.email AS owner_email,
              p.name AS landlord_name,
              p.address AS landlord_location, p.city AS property_city,
              p.property_type, p.description AS property_description,
              p.contact_phone, p.contact_email, p.total_rooms,
              p.max_occupancy_capacity, p.cover_image_url, p.gallery_image_urls
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       LEFT JOIN public.landlord_properties p ON p.id = a.property_id
       WHERE a.id = $1::uuid`,
      [id]
    );
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { rows: roomRows } = r.property_id
      ? await pool.query<{
          id: string;
          room_no: string;
          capacity: number;
          monthly_rate: string;
          status: string;
          remarks: string | null;
          listing_location: string | null;
          listing_description: string | null;
          listing_background_url: string | null;
          listing_image_urls: unknown;
          room_image_urls: unknown;
          room_size_label: string | null;
          room_details: string | null;
        }>(
          `SELECT id, room_no, capacity, monthly_rate::text, status, remarks,
                  listing_location, listing_description, listing_background_url,
                  listing_image_urls, room_image_urls, room_size_label, room_details
           FROM public.landlord_rooms
           WHERE property_id = $1::uuid AND owner_user_id = $2::uuid
           ORDER BY room_no`,
          [r.property_id, r.owner_user_id]
        )
      : { rows: [] };

    return NextResponse.json({
      id: r.id,
      dormName: r.dorm_name,
      address: r.address,
      status: r.status,
      documentsCount: r.documents_count,
      submittedAt: new Date(r.submitted_at).toISOString().slice(0, 10),
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      ownerUserId: r.owner_user_id,
      formData: r.form_data,
      inspectionScheduledFor: r.inspection_scheduled_for,
      updatedAt: new Date(r.updated_at).toISOString().slice(0, 10),
      accreditationExpiresAt: r.accreditation_expires_at
        ? new Date(r.accreditation_expires_at).toISOString().slice(0, 10)
        : null,
      landlordName: r.landlord_name,
      landlordLocation: r.landlord_location,
      dormitoryInfo: {
        name: r.landlord_name ?? r.dorm_name,
        address: r.landlord_location ?? r.address,
        city: r.property_city,
        propertyType: r.property_type,
        description: r.property_description,
        contactPhone: r.contact_phone,
        contactEmail: r.contact_email,
        totalRooms: r.total_rooms,
        maxOccupancyCapacity: r.max_occupancy_capacity,
        coverImageUrl: r.cover_image_url,
        galleryImageUrls: stringArray(r.gallery_image_urls),
        rooms: roomRows.map((room) => ({
          id: room.id,
          roomNumber: room.room_no,
          capacity: room.capacity,
          monthlyRate: room.monthly_rate,
          status: room.status,
          remarks: room.remarks,
          location: room.listing_location,
          description: room.listing_description,
          backgroundImageUrl: room.listing_background_url,
          listingImageUrls: stringArray(room.listing_image_urls),
          roomImageUrls: stringArray(room.room_image_urls),
          sizeLabel: room.room_size_label,
          details: room.room_details,
        })),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireOsaStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: string;
      remarks?: string;
      inspectionScheduledFor?: string | null;
      inspectionScheduleProposal?: string;
    };

    const proposedDate = body.inspectionScheduleProposal?.trim();
    if (proposedDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) {
        return NextResponse.json({ error: "Invalid inspection date." }, { status: 400 });
      }
      const pool = await getPool();
      const { rows } = await pool.query<{
        owner_user_id: string;
        dorm_name: string;
        status: string;
      }>(
        `SELECT owner_user_id, dorm_name, status
         FROM public.landlord_accreditation_requests
         WHERE id = $1::uuid`,
        [id]
      );
      const request = rows[0];
      if (!request) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      if (["Approved", "Rejected", "Expired"].includes(request.status)) {
        return NextResponse.json(
          { error: "This request can no longer be scheduled for inspection." },
          { status: 409 }
        );
      }

      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET form_data = COALESCE(form_data, '{}'::jsonb) || $2::jsonb,
             updated_at = now()
         WHERE id = $1::uuid`,
        [
          id,
          JSON.stringify({
            inspection_schedule_proposal: {
              proposedDate,
              status: "pending",
            },
          }),
        ]
      );
      await insertNotification(
        pool,
        request.owner_user_id,
        "Inspection date requires confirmation",
        `OSA proposed ${proposedDate} for the on-site inspection of “${request.dorm_name}”. Review the date in Accreditation Documents and approve it or suggest a change.`,
        "accreditation"
      );
      return NextResponse.json({ ok: true, pendingLandlordConfirmation: true });
    }

    if (session.role !== "OSA/SAS Admin") {
      return NextResponse.json(
        { error: "Staff can only propose inspection dates." },
        { status: 403 }
      );
    }

    const status = body.status && ACC_STATUSES.has(body.status) ? body.status : null;
    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const remarks = (body.remarks ?? "").trim();
    const pool = await getPool();

    const { rows: before } = await pool.query<{
      owner_user_id: string;
      dorm_name: string;
      status: string;
    }>(
      `SELECT owner_user_id, dorm_name, status FROM public.landlord_accreditation_requests WHERE id = $1::uuid`,
      [id]
    );
    const prev = before[0];
    if (!prev) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const inspDate =
      body.inspectionScheduledFor !== undefined
        ? body.inspectionScheduledFor?.trim() || null
        : undefined;

    const mergeJson =
      remarks.length > 0
        ? JSON.stringify({ osa_remarks: remarks })
        : null;

    if (mergeJson && inspDate !== undefined) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1,
             inspection_scheduled_for = $2::date,
             updated_at = now(),
             form_data = COALESCE(form_data, '{}'::jsonb) || $3::jsonb
         WHERE id = $4::uuid`,
        [status, inspDate, mergeJson, id]
      );
    } else if (mergeJson) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1, updated_at = now(),
             form_data = COALESCE(form_data, '{}'::jsonb) || $2::jsonb
         WHERE id = $3::uuid`,
        [status, mergeJson, id]
      );
    } else if (inspDate !== undefined) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1,
             inspection_scheduled_for = $2::date,
             updated_at = now()
         WHERE id = $3::uuid`,
        [status, inspDate, id]
      );
    } else {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1, updated_at = now()
         WHERE id = $2::uuid`,
        [status, id]
      );
    }

    if (status === "Approved") {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET accreditation_expires_at = COALESCE(
               accreditation_expires_at,
               now() + interval '1 year'
             ),
             updated_at = now()
         WHERE id = $1::uuid`,
        [id]
      );
      await pool.query(
        `UPDATE public.landlord_properties p
         SET name = trim(a.dorm_name),
             address = CASE
               WHEN trim(COALESCE(a.address, '')) = '' THEN p.address
               ELSE trim(a.address)
             END,
             updated_at = now()
         FROM public.landlord_accreditation_requests a
         WHERE a.id = $1::uuid
           AND a.property_id IS NOT NULL
           AND p.id = a.property_id
           AND trim(COALESCE(a.dorm_name, '')) <> ''`,
        [id]
      );
    }

    if (status === "Scheduled for Inspection" && inspDate) {
      await pool.query(
        `INSERT INTO public.os_accredit_inspections
          (accreditation_request_id, scheduled_for)
         VALUES ($1::uuid, $2::date)`,
        [id, inspDate]
      );
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Inspection scheduled",
        `OSA scheduled an on-site inspection for “${prev.dorm_name}” on ${inspDate}.`,
        "accreditation"
      );
    }

    if (status === "Approved" && prev.status !== "Approved") {
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Accreditation approved",
        `Your application for “${prev.dorm_name}” has been approved.`,
        "accreditation"
      );
    }
    if (status === "Rejected" && prev.status !== "Rejected") {
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Accreditation rejected",
        `Your application for “${prev.dorm_name}” was rejected.${remarks ? ` Note: ${remarks}` : ""}`,
        "accreditation"
      );
    }
    if (status === "Hold" && prev.status !== "Hold") {
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Accreditation on hold",
        `Your application for “${prev.dorm_name}” is on hold.${remarks ? ` ${remarks}` : ""}`,
        "accreditation"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
