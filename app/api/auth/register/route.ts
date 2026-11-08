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
    let role = "Student";
    let studentId = "";
    let course = "";
    let fatherName = "";
    let motherName = "";
    let location = "";
    let emergencyName = "";
    let emergencyPhone = "";
    let profileBuf: Buffer | null = null;
    let profileMime = "image/jpeg";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      fullName = getFormString(form, "fullName").trim();
      email = getFormString(form, "email").trim().toLowerCase();
      password = getFormString(form, "password");
      role = getFormString(form, "role") || "Student";
      studentId = getFormString(form, "studentId").trim();
      course = getFormString(form, "course").trim();
      fatherName = getFormString(form, "fatherName").trim();
      motherName = getFormString(form, "motherName").trim();
      location = getFormString(form, "location").trim();
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
        role?: string;
        studentId?: string;
        course?: string;
        fatherName?: string;
        motherName?: string;
        location?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
      };
      fullName = (body.fullName ?? "").trim();
      email = (body.email ?? "").trim().toLowerCase();
      password = body.password ?? "";
      role = body.role ?? "Student";
      studentId = (body.studentId ?? "").trim();
      course = (body.course ?? "").trim();
      fatherName = (body.fatherName ?? "").trim();
      motherName = (body.motherName ?? "").trim();
      location = (body.location ?? "").trim();
      emergencyName = (body.emergencyContactName ?? "").trim();
      emergencyPhone = (body.emergencyContactPhone ?? "").trim();
    }

    if (!["Student", "Landlord"].includes(role)) {
      return NextResponse.json({ error: "Choose a valid account type." }, { status: 400 });
    }

    if (
      !fullName ||
      !email ||
      !password ||
      password.length < 8 ||
      (role === "Student" &&
        (!studentId ||
          !course ||
          !fatherName ||
          !motherName ||
          !location ||
          !emergencyName ||
          !emergencyPhone))
    ) {
      return NextResponse.json(
        {
          error:
            role === "Student"
              ? "Name, email, password (8+ chars), student ID, course, father name, mother name, location, and emergency contact name/phone are required."
              : "Name, email, and password (8+ chars) are required.",
        },
        { status: 400 }
      );
    }

    if (role === "Student" && (!profileBuf || profileBuf.length === 0)) {
      return NextResponse.json(
        { error: "Profile picture is required." },
        { status: 400 }
      );
    }

    let profileUrl: string | null = null;
    if (profileBuf && profileBuf.length > 0) {
      try {
        profileUrl = await savePublicUpload(profileBuf, profileMime);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid profile image.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const pool = await getPool();

    const { rows } =
      role === "Student"
        ? await pool.query<{ id: string }>(
            `INSERT INTO public.boarding_house_app_users
              (full_name, email, role, status, password_hash, student_id,
               ict_verification_status, profile_image_url,
               emergency_contact_name, emergency_contact_phone, course,
               father_name, mother_name, location)
             VALUES ($1, $2, 'Student', 'Active', $3, $4,
               'Pending Verification', $5, $6, $7, $8, $9, $10, $11)
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
              fatherName,
              motherName,
              location,
            ]
          )
        : await pool.query<{ id: string }>(
            `INSERT INTO public.boarding_house_app_users
              (full_name, email, role, status, password_hash,
               ict_verification_status, profile_image_url)
             VALUES ($1, $2, 'Landlord', 'Pending', $3,
               'Pending Verification', $4)
             RETURNING id`,
            [fullName, email, password_hash, profileUrl]
          );
    const userId = rows[0]?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Registration failed." },
        { status: 500 }
      );
    }

    if (role === "Landlord") {
      return NextResponse.json({
        ok: true,
        pendingApproval: true,
        message:
          "Landlord registration submitted. You can sign in after ICT approves and activates your account.",
      });
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
