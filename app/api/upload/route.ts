import { NextResponse } from "next/server";
import { getSession } from "@/lib/require-session";
import { savePublicUpload } from "@/lib/save-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  const allowed =
    session &&
    (session.role === "Landlord" ||
      session.role === "Student" ||
      session.role === "ICT Admin" ||
      session.role === "OSA/SAS Admin");
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const uploadFile = file as File;
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await savePublicUpload(
      buf,
      uploadFile.type || "application/octet-stream",
      uploadFile.name || "upload"
    );
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
