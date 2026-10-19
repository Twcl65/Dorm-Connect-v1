import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireLandlord } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type TermsContent = {
  overview: string;
  paymentAndRemoval: string;
  consequences: string;
  examples: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  try {
    const pool = await getPool();
    let terms: { title: string; content: TermsContent } | null = null;

    // First try: property-specific active terms
    if (propertyId) {
      const propertyResult = await pool.query<{ title: string; content: TermsContent }>(
        `SELECT title, content FROM public.system_terms WHERE property_id IS NOT DISTINCT FROM $1::uuid AND is_active ORDER BY created_at DESC LIMIT 1`,
        [propertyId]
      );
      if (propertyResult.rows.length > 0) {
        terms = propertyResult.rows[0];
      }
    }

    // Fallback: global active terms (property_id IS NULL)
    if (!terms) {
      const globalResult = await pool.query<{ title: string; content: TermsContent }>(
        `SELECT title, content FROM public.system_terms WHERE property_id IS NULL AND is_active ORDER BY created_at DESC LIMIT 1`
      );
      if (globalResult.rows.length > 0) {
        terms = globalResult.rows[0];
      }
    }

    if (!terms) {
      return NextResponse.json({
        terms: {
          title: "Terms & Conditions",
          content: {
            overview: "",
            paymentAndRemoval: "",
            consequences: "",
            examples: "",
          },
        },
      });
    }
    return NextResponse.json({
      terms: {
        title: terms.title,
        content: terms.content,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load terms";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title: string = body.title?.trim() || "Terms & Conditions";
    const content: TermsContent = {
      overview: body.content?.overview?.trim() ?? "",
      paymentAndRemoval: body.content?.paymentAndRemoval?.trim() ?? "",
      consequences: body.content?.consequences?.trim() ?? "",
      examples: body.content?.examples?.trim() ?? "",
    };
    const propertyId = body.propertyId || null;

    const pool = await getPool();
    const existing = await pool.query(
      `SELECT id FROM public.system_terms WHERE property_id IS NOT DISTINCT FROM $1 AND is_active ORDER BY created_at DESC LIMIT 1`,
      [propertyId]
    );

    if (existing.rows.length > 0) {
      const currentVersion = await pool.query(
        `SELECT version FROM public.system_terms WHERE id = $1::uuid`,
        [existing.rows[0].id]
      );
      await pool.query(
        `UPDATE public.system_terms
         SET title = $1, content = $2, updated_by = $3, version = $4, updated_at = now()
         WHERE id = $5::uuid`,
        [title, content, session.sub, (currentVersion.rows[0]?.version ?? 0) + 1, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO public.system_terms (title, content, property_id, created_by, version, is_active)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [title, content, propertyId, session.sub, true]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save terms";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
