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

/** Inclusive calendar month count between lease start and end (matches server). */
export function countLeaseMonths(
  leaseStart: string | Date,
  leaseEnd: string | Date
): number {
  const toDate = (v: string | Date) =>
    typeof v === "string"
      ? new Date(`${v.slice(0, 10)}T12:00:00`)
      : new Date(v);
  const s = toDate(leaseStart);
  const e = toDate(leaseEnd);
  s.setHours(12, 0, 0, 0);
  e.setHours(12, 0, 0, 0);
  let months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  if (months < 1) months = 1;
  return months;
}

export function formatLeaseEndLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatLeaseSummary(
  moveInDate: string,
  leaseEndDate: string
): { months: number; label: string; endLabel: string } {
  const months = countLeaseMonths(moveInDate, leaseEndDate);
  const endLabel = formatLeaseEndLabel(leaseEndDate);
  const monthWord = months === 1 ? "month" : "months";
  return {
    months,
    label: `${months} ${monthWord}`,
    endLabel,
  };
}

export const RESERVATION_TERMS = [
  "Reservations are requests until the landlord confirms availability and terms.",
  "Rent, deposits, and utilities follow the landlord's policy and your signed lease.",
  "Misrepresentation or policy violations may result in cancellation.",
  "DormConnect facilitates booking; the lease is between you and the landlord.",
  "Tenants may be removed five (5) calendar days after a payment due date if the balance remains unpaid, subject to applicable school rules and written notice where required.",
  "By continuing you agree to follow house rules and quiet hours as posted on site.",
] as const;
