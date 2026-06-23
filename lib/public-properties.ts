import { getPool } from "@/lib/db";
import {
  buildPublicListingDescription,
  buildRoomListingGallery,
} from "@/lib/listing-description";

export type PublicPropertyRoom = {
  id: string;
  roomNo: string;
  capacity: number;
  price: number;
  status: "Available" | "Occupied" | "Reserved" | "Maintenance";
  description: string;
  images: string[];
};

export type PublicAccreditedProperty = {
  id: string;
  name: string;
  propertyType: string;
  address: string;
  city: string | null;
  description: string;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  latitude: number | null;
  longitude: number | null;
  availableRoomCount: number;
  listedRoomCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  rooms: PublicPropertyRoom[];
};

export async function fetchPublicAccreditedProperties(): Promise<PublicAccreditedProperty[]> {
  const pool = await getPool();

  const { rows: props } = await pool.query<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    description: string;
    cover_image_url: string | null;
    gallery_image_urls: unknown;
    latitude: string | null;
    longitude: string | null;
    property_type: string;
  }>(
    `SELECT p.id, p.name, p.address, p.city,
            COALESCE(NULLIF(trim(p.description), ''), '') AS description,
            p.cover_image_url, p.gallery_image_urls,
            p.latitude::text AS latitude, p.longitude::text AS longitude,
            p.property_type
     FROM public.landlord_properties p
     WHERE p.operational_status <> 'Not Operating'
       AND EXISTS (
         SELECT 1 FROM public.landlord_accreditation_requests acc
         WHERE acc.property_id = p.id AND acc.status = 'Approved'
       )
     ORDER BY p.name`
  );

  const out: PublicAccreditedProperty[] = [];

  for (const p of props) {
    const { rows: rooms } = await pool.query<{
      id: string;
      room_no: string;
      capacity: number;
      monthly_rate: string;
      status: string;
      listing_description: string | null;
      remarks: string | null;
      room_details: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
    }>(
      `SELECT r.id, r.room_no, r.capacity, r.monthly_rate::text, r.status,
              r.listing_description, r.remarks, r.room_details,
              r.listing_image_urls, r.listing_background_url, r.room_image_urls
       FROM public.landlord_rooms r
       WHERE r.property_id = $1::uuid
         AND r.is_listed = true
       ORDER BY r.room_no`,
      [p.id]
    );

    const gallery = Array.isArray(p.gallery_image_urls)
      ? (p.gallery_image_urls as string[]).filter((u) => typeof u === "string")
      : [];
    const cover = p.cover_image_url?.trim() || null;
    const propertyImages = [
      ...(cover ? [cover] : []),
      ...gallery,
    ];

    const mappedRooms: PublicPropertyRoom[] = rooms.map((r) => {
      const images = buildRoomListingGallery(
        r.listing_image_urls,
        r.listing_background_url,
        r.room_image_urls
      );
      const desc = buildPublicListingDescription(
        r.listing_description,
        r.remarks,
        r.room_details,
        `Room ${r.room_no}`
      );
      const status = (
        ["Available", "Occupied", "Reserved", "Maintenance"].includes(r.status)
          ? r.status
          : "Occupied"
      ) as PublicPropertyRoom["status"];

      return {
        id: r.id,
        roomNo: r.room_no,
        capacity: r.capacity,
        price: Number(r.monthly_rate),
        status,
        description: desc,
        images: images.length ? images : propertyImages.slice(0, 1),
      };
    });

    const availableRooms = mappedRooms.filter((r) => r.status === "Available");
    const prices = availableRooms.map((r) => r.price).filter((n) => Number.isFinite(n));

    const latRaw = p.latitude?.trim();
    const lngRaw = p.longitude?.trim();
    const latitude =
      latRaw != null && latRaw !== "" && !Number.isNaN(Number(latRaw))
        ? Number(latRaw)
        : null;
    const longitude =
      lngRaw != null && lngRaw !== "" && !Number.isNaN(Number(lngRaw))
        ? Number(lngRaw)
        : null;

    out.push({
      id: p.id,
      name: p.name,
      propertyType: p.property_type,
      address: p.address?.trim() || "Address on request",
      city: p.city?.trim() || null,
      description: p.description || "No description provided.",
      coverImageUrl: cover,
      galleryImageUrls: gallery,
      latitude,
      longitude,
      availableRoomCount: availableRooms.length,
      listedRoomCount: mappedRooms.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      rooms: mappedRooms,
    });
  }

  return out;
}
