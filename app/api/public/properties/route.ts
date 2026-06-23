import { NextResponse } from "next/server";
import { fetchPublicAccreditedProperties } from "@/lib/public-properties";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const properties = await fetchPublicAccreditedProperties();
    return NextResponse.json({ properties });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load accredited properties";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
