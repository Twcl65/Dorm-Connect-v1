import { getApiBaseUrl, isLoopbackApiOnPhysicalDevice } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const base = getApiBaseUrl();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn("[api] network error", path, base, e);
    }
    throw new NetworkError(
      `Cannot reach the server at ${base}. On a phone, use your PC's Wi‑Fi IP (not localhost), same network as your computer, and run "npm run dev" in the project root.`,
      e
    );
  }

  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  } catch {
    if (__DEV__) {
      console.warn("[api] non-JSON response", path, res.status, text.slice(0, 200));
    }
    throw new ApiError(
      res.ok
        ? "Invalid response from server."
        : `Server error (${res.status}). Is the API running at ${base}?`,
      res.status
    );
  }

  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? `Request failed (${res.status})`;
    if (__DEV__) {
      console.warn("[api] error", path, res.status, message);
    }
    throw new ApiError(message, res.status);
  }

  return data;
}

/** Quick check that the Next.js API is reachable (used on login screen). */
export async function checkApiReachable(): Promise<
  "ok" | "unreachable" | "wrong_host"
> {
  if (isLoopbackApiOnPhysicalDevice()) {
    return "wrong_host";
  }
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/auth/me`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    await res.text();
    return res.status === 401 || res.ok ? "ok" : "unreachable";
  } catch (e) {
    if (__DEV__) console.warn("[api] reachability check failed", base, e);
    return "unreachable";
  }
}

export function formatSignInError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError) return error.message;
  if (error instanceof Error) {
    if (error.message.includes("SecureStore")) {
      return "Could not save your session. Close and reopen Expo Go, then try again.";
    }
    if (__DEV__ && error.message.trim()) {
      return error.message;
    }
  }
  if (__DEV__ && error != null) {
    console.warn("[auth] sign-in error", error);
  }
  return "Sign-in failed. Check the API line below and that the web app is running (npm run dev).";
}

export type MobileLoginResponse = {
  ok: boolean;
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profileImageUrl: string | null;
    ictVerificationStatus: string | null;
  };
};

export type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profileImageUrl: string | null;
    ictVerificationStatus: string | null;
  } | null;
};

export type Listing = {
  id: string;
  name: string;
  price: number;
  location: string;
  documentType: string;
  description: string;
  distance: string;
  landlord: string;
  roomType: string;
  capacity: string;
  roomSizeLabel?: string | null;
  roomDetails?: string | null;
  amenities: string[];
  images: string[];
  reviewSummary: { avg: number | null; count: number };
  myReservationStatus?: "Pending" | "Confirmed" | null;
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyContactPhone: string | null;
  propertyDescription: string | null;
  propertyCoverImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RoomReview = {
  author: string;
  date: string;
  comment: string;
  rating: number;
};

export type UnpaidRentMonth = {
  dueDate: string;
  amount: number;
  monthNumber: number;
  monthLabel: string;
  dueLabel: string;
  dormName?: string;
  roomNo?: string;
};

export type OverviewResponse = {
  reservations: {
    id: string;
    dormName: string;
    roomNo: string;
    leasePeriod: string;
    reservationStatus: string;
    paymentStatus: string;
    monthlyRent: number;
  }[];
  activeReservation: OverviewResponse["reservations"][0] | null;
  latestPayment: {
    amount: number;
    status: string;
    paidAtLabel: string | null;
  } | null;
  paymentHint: string;
  upcomingUnpaidMonths?: UnpaidRentMonth[];
};

export type ReservationRow = {
  id: string;
  dormName: string;
  roomNo: string;
  leasePeriod: string;
  status: string;
  landlordApproved: boolean;
  monthlyRent: number;
  paymentSent: boolean;
};

export type StudentReservation = {
  id: string;
  dorm: string;
  room: string;
  status: string;
  date: string;
  moveInDate: string;
  leaseMonths: number;
  monthlyRent: number;
  location: string;
  landlord: string;
  distance?: string;
  documentType?: string;
  description?: string;
  roomDetails?: string | null;
  roomSizeLabel?: string | null;
  capacity?: string;
  amenities?: string[];
  images?: string[];
  leasePeriod?: string;
  paymentSent?: boolean;
};

export type PaymentRow = {
  id: string;
  dormName: string;
  roomNo: string;
  amount: number;
  method: string;
  status: string;
  date: string;
  leasePeriod?: string;
  paidAt?: string;
  source?: "student_app" | "landlord_entry";
  entrySource?: "manual" | "advance" | "deposit";
  channelLabel?: string;
  description?: string;
  referenceNo?: string;
  receiptUrl?: string;
  proofImageUrl?: string;
  landlordProofUrl?: string;
  location?: string;
  landlord?: string;
  monthlyRent?: number;
};

export type PaymentReceiptLineItem = { label: string; amount: number };

export type PaymentReceiptData = {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  dormName: string;
  roomNo: string;
  landlord: string;
  leasePeriod: string;
  studentName: string;
  monthlyRent: number | null;
  lineItems: PaymentReceiptLineItem[] | null;
  notes: string | null;
  periodLabel?: string | null;
  source?: "student_app" | "landlord_entry";
};

export type ReviewableRoom = {
  roomId: string;
  roomNo: string;
  propertyName: string;
  propertyAddress: string | null;
  reservationStatus: string;
  existingReview: {
    id: string;
    rating: number;
    title: string;
    comment: string;
    reviewedAt: string | null;
  } | null;
};

export type MyReview = {
  roomId: string;
  roomNo: string;
  propertyName: string;
  propertyAddress: string | null;
  reservationStatus: string;
  id: string;
  rating: number;
  title: string;
  comment: string;
  reviewedAt: string | null;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  date: string;
  source?: "osa" | "landlord";
  propertyName?: string;
};

export type IncidentReport = {
  id: string;
  title: string;
  description: string;
  status: string;
  imageUrls: string[];
  createdAt: string;
  roomNo: string | null;
  propertyName: string | null;
  landlordName: string | null;
};

export type IncidentRoom = {
  roomId: string;
  roomNo: string;
  propertyName: string;
};

export type ProfilePayload = {
  fullName: string;
  email: string;
  role: string;
  studentId: string | null;
  profileImageUrl: string | null;
};

export type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  synthetic?: boolean;
};

export type MapPropertyRoom = {
  id: string;
  roomNo: string;
  capacity: number;
  price: number;
  status: string;
  description: string;
  images: string[];
};

export type MapProperty = {
  id: string;
  name: string;
  propertyType: string;
  address: string;
  contactPhone: string;
  description: string;
  landlordName: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  propertyImages: string[];
  rooms: MapPropertyRoom[];
};

export type LandlordOverview = {
  propertiesCount: number;
  rooms: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
  };
  reservations: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  paymentsThisMonth: string;
  accreditation: { approved: number; pending: number };
  activities: { description: string; time: string }[];
  roomsPreview: {
    id: string;
    roomNo: string;
    capacity: number;
    rate: string;
    status: string;
  }[];
  tenantsPreview: {
    id: string;
    roomNo: string;
    name: string;
    leasePeriod: string;
    paymentStatus: string;
  }[];
};

export type LandlordReservation = {
  id: string;
  roomNo: string;
  name: string;
  leasePeriod: string;
  reservationStatus: "Confirmed" | "Pending" | "Cancelled";
  dormName: string;
  rentPaymentStatus?: string;
  createdAt: string;
};

export type LandlordPayment = {
  id: string;
  source: "landlord" | "student" | "advance" | "deposit";
  roomNo: string;
  propertyName?: string;
  name: string;
  amount: string;
  amountValue?: number;
  method: string;
  status: "Paid" | "Pending" | "Overdue";
  date?: string;
  periodLabel?: string;
  createdAt: string;
  tenantLeaseId?: string;
  studentUserId?: string;
  reservationId?: string;
};

export type LandlordLease = {
  id: string;
  roomNo: string;
  name: string;
  leasePeriod: string;
  paymentStatus: string;
  dueLabel?: string;
};

export type LandlordOnsiteRoom = {
  roomId: string;
  roomNo: string;
  propertyId: string;
  propertyName: string;
  suggestedTenantName: string | null;
  tenantLeaseId: string | null;
  studentUserId: string | null;
  studentReservationId: string | null;
};

export type LandlordIncident = {
  id: string;
  title: string;
  description: string;
  status: string;
  imageUrls: string[];
  createdAt: string;
  roomNo: string | null;
  propertyName: string | null;
  reporterName: string;
};

export type OsaAnnouncement = {
  id: string;
  title: string;
  message: string;
  date: string;
};

export type LandlordTenantAnnouncement = {
  id: string;
  title: string;
  message: string;
  date: string;
  audience: "all_booked" | "single_student";
  propertyName: string;
  targetStudentName: string | null;
};

export type LandlordPropertyRow = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  propertyType?: string;
  totalRooms?: number;
  operationalStatus?: string;
};

export type LandlordRoomRow = {
  id: string;
  roomNo: string;
  propertyName: string;
  status: string;
  monthlyRate?: string;
  capacity?: number;
};

export type LandlordAccreditationRow = {
  id: string;
  dormName: string;
  address: string;
  status: string;
  documentsCount: number;
  submittedDate: string;
};

export type ActivityLogRow = {
  id: string;
  description: string;
  createdAt: string;
};
