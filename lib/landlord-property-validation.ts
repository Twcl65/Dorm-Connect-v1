export type PropertyType = "Dormitory" | "Boarding House";

export type LandlordPropertyFields = {
  name: string;
  propertyType: PropertyType;
  description: string;
  address: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  totalRooms: string;
  maxOccupancyCapacity: string;
  latitude: string;
  longitude: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Philippine mobile: 09XXXXXXXXX, +639XXXXXXXXX, or 639XXXXXXXXX */
export function isValidPhilippinePhone(raw: string): boolean {
  const digits = raw.replace(/[\s\-().]/g, "");
  return /^(\+63|63|0)9\d{9}$/.test(digits);
}

export function normalizePhilippinePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^\+639\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  return raw.trim();
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function parseOptionalCoord(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateLandlordPropertyForm(
  fields: LandlordPropertyFields
): string[] {
  const errors: string[] = [];
  const name = fields.name.trim();
  const propertyType: PropertyType =
    fields.propertyType === "Boarding House" ? "Boarding House" : "Dormitory";
  const description = fields.description.trim();
  const address = fields.address.trim();
  const city = fields.city.trim();
  const contactPhone = fields.contactPhone.trim();
  const contactEmail = fields.contactEmail.trim();
  const totalRooms = parseOptionalInt(fields.totalRooms);
  const maxOccupancy = parseOptionalInt(fields.maxOccupancyCapacity);
  const latitude = parseOptionalCoord(fields.latitude);
  const longitude = parseOptionalCoord(fields.longitude);

  if (!name) {
    errors.push("Property name is required.");
  } else if (name.length < 3) {
    errors.push("Property name must be at least 3 characters.");
  }

  if (propertyType === "Boarding House") {
    if (!description) {
      errors.push("Description is required for a boarding house.");
    } else if (description.length < 20) {
      errors.push(
        "Boarding house description must be at least 20 characters (include amenities, rules, or location details)."
      );
    }

    if (!address) {
      errors.push("Street address is required for a boarding house.");
    } else if (address.length < 5) {
      errors.push("Enter a complete street address for the boarding house.");
    }

    if (!city) {
      errors.push("City / area is required for a boarding house.");
    }

    if (!contactPhone) {
      errors.push("Contact phone is required for a boarding house.");
    } else if (!isValidPhilippinePhone(contactPhone)) {
      errors.push(
        "Enter a valid Philippine mobile number (e.g. 09171234567)."
      );
    }

    if (totalRooms == null) {
      errors.push("Total rooms is required for a boarding house.");
    } else if (totalRooms < 1) {
      errors.push("Total rooms must be at least 1.");
    } else if (totalRooms > 500) {
      errors.push("Total rooms looks too high — check the number you entered.");
    }

    if (maxOccupancy == null) {
      errors.push("Max occupancy is required for a boarding house.");
    } else if (maxOccupancy < 1) {
      errors.push("Max occupancy must be at least 1.");
    } else if (totalRooms != null && maxOccupancy < totalRooms) {
      errors.push(
        "Max occupancy cannot be less than total rooms (each room needs at least one bed space)."
      );
    }

    if (latitude == null || longitude == null) {
      errors.push(
        "Map coordinates (latitude and longitude) are required for a boarding house so students can find it on the map."
      );
    } else {
      if (latitude < -90 || latitude > 90) {
        errors.push("Latitude must be between -90 and 90.");
      }
      if (longitude < -180 || longitude > 180) {
        errors.push("Longitude must be between -180 and 180.");
      }
    }
  } else {
    if (contactPhone && !isValidPhilippinePhone(contactPhone)) {
      errors.push(
        "Enter a valid Philippine mobile number (e.g. 09171234567) or leave phone blank."
      );
    }

    if (totalRooms != null && totalRooms < 1) {
      errors.push("Total rooms must be at least 1 when provided.");
    }

    if (maxOccupancy != null && maxOccupancy < 1) {
      errors.push("Max occupancy must be at least 1 when provided.");
    }

    if (
      totalRooms != null &&
      maxOccupancy != null &&
      maxOccupancy < totalRooms
    ) {
      errors.push("Max occupancy cannot be less than total rooms.");
    }

    const hasLat = latitude != null;
    const hasLng = longitude != null;
    if (hasLat !== hasLng) {
      errors.push("Enter both latitude and longitude, or leave both blank.");
    } else if (hasLat && hasLng) {
      if (latitude! < -90 || latitude! > 90) {
        errors.push("Latitude must be between -90 and 90.");
      }
      if (longitude! < -180 || longitude! > 180) {
        errors.push("Longitude must be between -180 and 180.");
      }
    }
  }

  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    errors.push("Enter a valid contact email or leave it blank.");
  }

  if (fields.totalRooms.trim() && totalRooms == null) {
    errors.push("Total rooms must be a whole number.");
  }

  if (fields.maxOccupancyCapacity.trim() && maxOccupancy == null) {
    errors.push("Max occupancy must be a whole number.");
  }

  if (fields.latitude.trim() && latitude == null) {
    errors.push("Latitude must be a valid number.");
  }

  if (fields.longitude.trim() && longitude == null) {
    errors.push("Longitude must be a valid number.");
  }

  return errors;
}

export type NormalizedLandlordPropertyPayload = {
  name: string;
  propertyType: PropertyType;
  description: string;
  address: string | null;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  totalRooms: number | null;
  maxOccupancyCapacity: number | null;
  latitude: number | null;
  longitude: number | null;
};

export function normalizeLandlordPropertyForm(
  fields: LandlordPropertyFields
): NormalizedLandlordPropertyPayload {
  const propertyType: PropertyType =
    fields.propertyType === "Boarding House" ? "Boarding House" : "Dormitory";
  const lat = parseOptionalCoord(fields.latitude);
  const lng = parseOptionalCoord(fields.longitude);
  const phone = fields.contactPhone.trim();

  return {
    name: fields.name.trim(),
    propertyType,
    description: fields.description.trim(),
    address: fields.address.trim() || null,
    city: fields.city.trim() || null,
    contactPhone: phone ? normalizePhilippinePhone(phone) : null,
    contactEmail: fields.contactEmail.trim() || null,
    totalRooms: parseOptionalInt(fields.totalRooms),
    maxOccupancyCapacity: parseOptionalInt(fields.maxOccupancyCapacity),
    latitude:
      lat != null && lat >= -90 && lat <= 90 ? lat : null,
    longitude:
      lng != null && lng >= -180 && lng <= 180 ? lng : null,
  };
}

export function normalizeLandlordPropertyPayload(input: {
  name: string;
  propertyType: PropertyType;
  description: string;
  address: string | null;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  totalRooms: number | null;
  maxOccupancyCapacity: number | null;
  latitude: number | null;
  longitude: number | null;
}): NormalizedLandlordPropertyPayload {
  const phone = input.contactPhone?.trim() ?? "";
  const totalRooms =
    input.totalRooms != null && Number.isFinite(input.totalRooms)
      ? Math.max(0, Math.floor(Number(input.totalRooms)))
      : null;
  const maxOccupancyCapacity =
    input.maxOccupancyCapacity != null &&
    Number.isFinite(input.maxOccupancyCapacity)
      ? Math.max(0, Math.floor(Number(input.maxOccupancyCapacity)))
      : null;
  let lat =
    input.latitude != null && Number.isFinite(Number(input.latitude))
      ? Number(input.latitude)
      : null;
  let lng =
    input.longitude != null && Number.isFinite(Number(input.longitude))
      ? Number(input.longitude)
      : null;
  if (lat != null && (lat < -90 || lat > 90)) lat = null;
  if (lng != null && (lng < -180 || lng > 180)) lng = null;

  return {
    name: input.name.trim(),
    propertyType: input.propertyType,
    description: input.description.trim(),
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    contactPhone: phone ? normalizePhilippinePhone(phone) : null,
    contactEmail: input.contactEmail?.trim() || null,
    totalRooms,
    maxOccupancyCapacity,
    latitude: lat,
    longitude: lng,
  };
}

export function validateLandlordPropertyPayload(
  payload: NormalizedLandlordPropertyPayload
): string[] {
  return validateLandlordPropertyForm({
    name: payload.name,
    propertyType: payload.propertyType,
    description: payload.description,
    address: payload.address ?? "",
    city: payload.city ?? "",
    contactPhone: payload.contactPhone ?? "",
    contactEmail: payload.contactEmail ?? "",
    totalRooms:
      payload.totalRooms != null ? String(payload.totalRooms) : "",
    maxOccupancyCapacity:
      payload.maxOccupancyCapacity != null
        ? String(payload.maxOccupancyCapacity)
        : "",
    latitude: payload.latitude != null ? String(payload.latitude) : "",
    longitude: payload.longitude != null ? String(payload.longitude) : "",
  });
}
