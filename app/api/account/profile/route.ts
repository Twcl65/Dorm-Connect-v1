import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/require-session";
import { setSessionCookieOnResponse } from "@/lib/auth-cookie";
import { isAllowedStoredFileUrl } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "Student",
  "Landlord",
  "ICT Admin",
  "OSA/SAS Admin",
]);

function isSafeProfileImageUrl(v: string): boolean {
  const s = v.trim();
  if (!s) return true;
  return isAllowedStoredFileUrl(s);
}

export async function GET() {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows: urows } = await pool.query<{
      full_name: string;
      email: string;
      role: string;
      student_id: string | null;
      profile_image_url: string | null;
    }>(
      `SELECT full_name, email, role, student_id, profile_image_url
       FROM public.boarding_house_app_users
       WHERE id = $1::uuid`,
      [session.sub]
    );
    const u = urows[0];
    if (!u) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    let latestAccreditation: {
      id: string;
      dormName: string;
      address: string;
      status: string;
      submittedAt: string;
      documentsCount: number;
      formData: unknown;
    } | null = null;

    if (u.role === "Landlord") {
      const { rows: arows } = await pool.query<{
        id: string;
        dorm_name: string;
        address: string;
        status: string;
        submitted_at: Date;
        documents_count: number;
        form_data: unknown;
      }>(
        `SELECT id, dorm_name, address, status, submitted_at, documents_count, form_data
         FROM public.landlord_accreditation_requests
         WHERE owner_user_id = $1::uuid
         ORDER BY submitted_at DESC
         LIMIT 1`,
        [session.sub]
      );
      const a = arows[0];
      if (a) {
        latestAccreditation = {
          id: a.id,
          dormName: a.dorm_name,
          address: a.address,
          status: a.status,
          submittedAt: new Date(a.submitted_at).toISOString().slice(0, 10),
          documentsCount: a.documents_count,
          formData: a.form_data,
        };
      }
    }

    return NextResponse.json({
      profile: {
        fullName: u.full_name,
        email: u.email,
        role: u.role,
        studentId: u.student_id?.trim() ? u.student_id.trim() : null,
        profileImageUrl: u.profile_image_url?.trim() || null,
        latestAccreditation,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      fullName?: string;
      studentId?: string | null;
      profileImageUrl?: string | null;
    };

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      full_name: string;
      email: string;
      role: string;
    }>(
      `SELECT full_name, email, role FROM public.boarding_house_app_users WHERE id = $1::uuid`,
      [session.sub]
    );
    const row = cur[0];
    if (!row) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    let nextName = row.full_name;
    let nextStudentId: string | null | undefined;
    let nextAvatar: string | null | undefined;

    if (body.fullName !== undefined) {
      const fn = body.fullName.trim();
      if (fn.length < 1 || fn.length > 200) {
        return NextResponse.json(
          { error: "Display name must be between 1 and 200 characters." },
          { status: 400 }
        );
      }
      nextName = fn;
    }

    if (body.studentId !== undefined) {
      if (row.role !== "Student") {
        return NextResponse.json(
          { error: "School ID can only be updated for student accounts." },
          { status: 400 }
        );
      }
      const sid = body.studentId === null ? "" : String(body.studentId).trim();
      if (sid.length > 64) {
        return NextResponse.json(
          { error: "School ID is too long (max 64 characters)." },
          { status: 400 }
        );
      }
      if (sid) {
        const { rows: clash } = await pool.query<{ id: string }>(
          `SELECT id FROM public.boarding_house_app_users
           WHERE student_id IS NOT NULL AND lower(trim(student_id)) = lower(trim($1))
             AND id <> $2::uuid
           LIMIT 1`,
          [sid, session.sub]
        );
        if (clash[0]) {
          return NextResponse.json(
            { error: "That school ID is already linked to another account." },
            { status: 409 }
          );
        }
      }
      nextStudentId = sid || null;
    }

    if (body.profileImageUrl !== undefined) {
      const raw =
        body.profileImageUrl === null || body.profileImageUrl === ""
          ? ""
          : String(body.profileImageUrl).trim();
      if (raw && !isSafeProfileImageUrl(raw)) {
        return NextResponse.json(
          { error: "Invalid profile image URL." },
          { status: 400 }
        );
      }
      nextAvatar = raw || null;
    }

    const updates: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (body.fullName !== undefined) {
      updates.push(`full_name = $${i++}`);
      vals.push(nextName);
    }
    if (nextStudentId !== undefined) {
      updates.push(`student_id = $${i++}`);
      vals.push(nextStudentId);
    }
    if (nextAvatar !== undefined) {
      updates.push(`profile_image_url = $${i++}`);
      vals.push(nextAvatar);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    vals.push(session.sub);
    await pool.query(
      `UPDATE public.boarding_house_app_users
       SET ${updates.join(", ")}, updated_at = now()
       WHERE id = $${i}::uuid`,
      vals
    );

    const res = NextResponse.json({ ok: true, fullName: nextName });
    if (body.fullName !== undefined && nextName !== session.name) {
      await setSessionCookieOnResponse(res, {
        sub: session.sub,
        email: row.email,
        name: nextName,
        role: session.role,
      });
    }
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
