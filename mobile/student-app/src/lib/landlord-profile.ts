import {
  ApiError,
  apiRequest,
  type LandlordPublicProfile,
  type Listing,
  type RoomReview,
  type StudentReservation,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/config";

function roomNoFromListing(listing: Listing): string {
  const match = listing.name.match(/Room\s+(.+)$/i);
  return match?.[1]?.trim() || listing.id.slice(0, 8);
}

async function loadFromListings(
  token: string,
  propertyId: string
): Promise<LandlordPublicProfile> {
  const res = await apiRequest<{ listings: Listing[] }>(
    "/api/student/listings",
    { token }
  );
  const all = res.listings ?? [];
  let rooms = all.filter((l) => l.propertyId === propertyId);
  if (rooms.length === 0) {
    const asRoom = all.find((l) => l.id === propertyId);
    if (asRoom?.propertyId) {
      rooms = all.filter((l) => l.propertyId === asRoom.propertyId);
    }
  }
  if (rooms.length === 0) {
    throw new ApiError("Landlord not found.", 404);
  }

  const first = rooms[0];
  const reviewGroups = await Promise.all(
    rooms.map(async (room) => {
      try {
        const rev = await apiRequest<{ reviews: (RoomReview & { title?: string })[] }>(
          `/api/student/reviews?roomId=${encodeURIComponent(room.id)}`,
          { token }
        );
        const roomNo = roomNoFromListing(room);
        return (rev.reviews ?? []).map((r) => ({
          author: r.author,
          date: r.date,
          title: r.title ?? "",
          comment: r.comment,
          rating: r.rating,
          roomNo,
          propertyName: first.propertyName,
        }));
      } catch {
        return [];
      }
    })
  );
  const reviews = reviewGroups.flat();
  const count = reviews.length;
  const avg =
    count > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
      : null;

  let gcashAccountName: string | null = null;
  let gcashPhone: string | null = null;
  let gcashQrCodeUrl: string | null = null;
  try {
    const booked = await apiRequest<{ reservations: StudentReservation[] }>(
      "/api/student/reservations",
      { token }
    );
    const match = (booked.reservations ?? []).find(
      (r) => r.landlord === first.landlord
    );
    if (match) {
      gcashAccountName = match.gcashAccountName ?? null;
      gcashPhone = match.gcashPhone ?? null;
      gcashQrCodeUrl = match.gcashQrCodeUrl ?? null;
    }
  } catch {
    /* optional */
  }

  return {
    landlord: {
      id: first.landlordUserId ?? first.propertyId,
      name: first.landlord,
      gcashAccountName,
      gcashPhone,
      gcashQrCodeUrl: resolveMediaUrl(gcashQrCodeUrl),
    },
    property: {
      id: first.propertyId,
      name: first.propertyName,
      address:
        [first.propertyAddress, first.propertyCity].filter(Boolean).join(", ") ||
        first.location,
      contactPhone: first.propertyContactPhone,
      description: first.propertyDescription,
    },
    accreditation: {
      status: first.documentType || "Accredited",
      dormName: first.propertyName,
      submittedAt: null,
      expiresAt: null,
    },
    certifications: [],
    reviewSummary: { avg, count },
    reviews,
  };
}

/** Uses dedicated endpoint when deployed; otherwise the live student listings APIs. */
export async function fetchLandlordProfile(
  token: string,
  propertyId: string
): Promise<LandlordPublicProfile> {
  try {
    const profile = await apiRequest<LandlordPublicProfile>(
      `/api/student/landlord-profile?propertyId=${encodeURIComponent(propertyId)}`,
      { token }
    );
    return {
      ...profile,
      landlord: {
        ...profile.landlord,
        gcashQrCodeUrl: resolveMediaUrl(profile.landlord.gcashQrCodeUrl),
      },
      certifications: (profile.certifications ?? []).map((c) => ({
        ...c,
        url: resolveMediaUrl(c.url) ?? c.url,
      })),
    };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return loadFromListings(token, propertyId);
    }
    throw e;
  }
}
