import { NextResponse } from "next/server";
import {
  PUBLIC_CACHE_TTL_MS,
  cachedJsonResponse,
  cacheKey,
} from "@/lib/api-cache";
import { fetchPublicAccreditedProperties } from "@/lib/public-properties";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await cachedJsonResponse(
      cacheKey(["public", "properties"]),
      PUBLIC_CACHE_TTL_MS,
      async () => {
        const properties = await fetchPublicAccreditedProperties();
        return { properties };
      }
    );
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load accredited properties";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
