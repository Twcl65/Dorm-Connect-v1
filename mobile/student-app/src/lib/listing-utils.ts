export function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function showRoomDetailsAside(
  description: string,
  roomDetails: string | null | undefined
): boolean {
  if (!roomDetails?.trim()) return false;
  return !normWs(description).includes(normWs(roomDetails));
}

export function listingImageUrls(listing: {
  images: string[];
  propertyCoverImageUrl: string | null;
}): string[] {
  const urls: string[] = [];
  const add = (u: string | null | undefined) => {
    const t = u?.trim();
    if (t && !urls.includes(t)) urls.push(t);
  };
  for (const img of listing.images) add(img);
  add(listing.propertyCoverImageUrl);
  return urls;
}

export function addMonthsIso(start: string, months: number): string {
  const d = new Date(`${start}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const RESERVATION_TERMS = [
  "Reservations are requests until the landlord confirms availability and terms.",
  "Rent, deposits, and utilities follow the landlord's policy and your signed lease.",
  "Misrepresentation or policy violations may result in cancellation.",
  "DormConnect facilitates booking; the lease is between you and the landlord.",
  "Tenants may be removed five (5) calendar days after a payment due date if the balance remains unpaid, subject to applicable school rules and written notice where required.",
  "By continuing you agree to follow house rules and quiet hours as posted on site.",
] as const;
