/** Normalize whitespace for substring checks. */
function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * If the same long fragment appears at both start and end (common copy-paste mistake),
 * keep a single occurrence.
 */
export function stripRepeatedBookend(text: string): string {
  let t = text.trim();
  if (t.length < 24) return t;

  const norm = (s: string) => s.replace(/\s+/g, " ").trim();

  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let len = Math.min(Math.floor(t.length / 2), 400); len >= 20; len--) {
      const start = norm(t.slice(0, len));
      const end = norm(t.slice(-len));
      if (start.length < 20) continue;
      if (start === end) {
        t = t.slice(0, -len).trim();
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return t;
}

/**
 * Public listing description: prefer listing text, merge room_details only when not redundant.
 */
export function buildPublicListingDescription(
  listingDescription: string | null,
  remarks: string | null,
  roomDetails: string | null,
  fallback: string
): string {
  const base =
    listingDescription?.trim() || remarks?.trim() || fallback;
  const extra = roomDetails?.trim();

  if (!extra) {
    return stripRepeatedBookend(base);
  }

  const baseN = normalizeWs(base);
  const extraN = normalizeWs(extra);

  if (baseN.includes(extraN) || extraN.includes(baseN)) {
    return stripRepeatedBookend(baseN.length >= extraN.length ? base : extra);
  }

  return stripRepeatedBookend(`${base}\n\n${extra}`);
}

const FALLBACK_LISTING_IMAGE =
  "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200";

/** Listing cover + gallery URLs (same logic as student listings browse). */
export function buildRoomListingGallery(
  listing_image_urls: unknown,
  listing_background_url: string | null,
  room_image_urls: unknown
): string[] {
  const listingImgs =
    Array.isArray(listing_image_urls) &&
    (listing_image_urls as string[]).every((x) => typeof x === "string")
      ? (listing_image_urls as string[])
      : [];
  const roomImgs =
    Array.isArray(room_image_urls) &&
    (room_image_urls as string[]).every((x) => typeof x === "string")
      ? (room_image_urls as string[])
      : [];
  const mergedGallery = [...new Set([...listingImgs, ...roomImgs])];
  const bg =
    listing_background_url &&
    listing_background_url.startsWith("/uploads/")
      ? listing_background_url
      : null;
  const rest = mergedGallery.filter((u) => u !== bg);
  if (bg || rest.length > 0) {
    return [...(bg ? [bg] : []), ...rest];
  }
  return [FALLBACK_LISTING_IMAGE];
}
