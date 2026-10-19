import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { savePublicUpload } from "@/lib/save-upload";
import { DB_ROLE_TO_ROUTE, SESSION_COOKIE } from "@/lib/auth-config";
import { signSessionToken } from "@/lib/session-token";
import { getFormField, getFormString } from "@/lib/request-form-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    let fullName = "";
    let email = "";
    let password = "";
    let studentId = "";
    let course = "";
    let emergencyName = "";
    let emergencyPhone = "";
    let profileBuf: Buffer | null = null;
    let profileMime = "image/jpeg";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      fullName = getFormString(form, "fullName").trim();
      email = getFormString(form, "email").trim().toLowerCase();
      password = getFormString(form, "password");
      studentId = getFormString(form, "studentId").trim();
      course = getFormString(form, "course").trim();
      emergencyName = getFormString(form, "emergencyContactName").trim();
      emergencyPhone = getFormString(form, "emergencyContactPhone").trim();
      const file = getFormField(form, "profileImage");
      if (file && file instanceof Blob && file.size > 0) {
        profileMime =
          (file as File).type || "application/octet-stream";
        profileBuf = Buffer.from(await file.arrayBuffer());
      }
    } else {
      const body = (await req.json()) as {
        fullName?: string;
        email?: string;
        password?: string;
        studentId?: string;
        course?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
      };
      fullName = (body.fullName ?? "").trim();
      email = (body.email ?? "").trim().toLowerCase();
      password = body.password ?? "";
      studentId = (body.studentId ?? "").trim();
      course = (body.course ?? "").trim();
      emergencyName = (body.emergencyContactName ?? "").trim();
      emergencyPhone = (body.emergencyContactPhone ?? "").trim();
    }

    if (
      !fullName ||
      !email ||
      !password ||
      password.length < 8 ||
      !studentId ||
      !course ||
      !emergencyName ||
      !emergencyPhone
    ) {
      return NextResponse.json(
        {
          error:
            "Name, email, password (8+ chars), student ID, course, emergency contact name/phone are required.",
        },
        { status: 400 }
      );
    }

    if (!profileBuf || profileBuf.length === 0) {
      return NextResponse.json(
        { error: "Profile picture is required." },
        { status: 400 }
      );
    }

    let profileUrl: string;
    try {
      profileUrl = await savePublicUpload(profileBuf, profileMime);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid profile image.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const pool = await getPool();

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.boarding_house_app_users
        (full_name, email, role, status, password_hash, student_id,
         ict_verification_status, profile_image_url,
         emergency_contact_name, emergency_contact_phone, course)
       VALUES ($1, $2, 'Student', 'Active', $3, $4,
         'Pending Verification', $5, $6, $7, $8)
       RETURNING id`,
      [
        fullName,
        email,
        password_hash,
        studentId,
        profileUrl,
        emergencyName,
        emergencyPhone,
        course,
      ]
    );
    const userId = rows[0]?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Registration failed." },
        { status: 500 }
      );
    }

    const redirect = DB_ROLE_TO_ROUTE.Student;
    const token = await signSessionToken({
      sub: userId,
      email,
      name: fullName,
      role: "Student",
    });

    const res = NextResponse.json({
      ok: true,
      redirect,
      message:
        "Account created. You can browse dormitories while ICT verifies your registration.",
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "That email or student ID is already registered." },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
