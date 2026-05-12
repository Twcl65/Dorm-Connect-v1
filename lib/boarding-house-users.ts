export const BOARDING_ROLES = [
  "Student",
  "Landlord",
  "ICT Admin",
  "OSA/SAS Admin",
] as const;

export const BOARDING_STATUSES = ["Active", "Pending", "Inactive"] as const;

export const ICT_VERIFICATION_STATUSES = [
  "Pending Verification",
  "Verified",
  "Rejected",
] as const;

export type BoardingRole = (typeof BOARDING_ROLES)[number];
export type BoardingStatus = (typeof BOARDING_STATUSES)[number];
export type IctVerificationStatus = (typeof ICT_VERIFICATION_STATUSES)[number];

export type BoardingHouseUserRow = {
  id: string;
  seq_id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  student_id: string | null;
  ict_verification_status: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  course: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type BoardingHouseUserDto = {
  id: string;
  displayId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  studentId: string | null;
  ictVerificationStatus: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  course: string | null;
  createdDate: string;
  lastLogin: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateTime(d: Date): string {
  const iso = d.toISOString().replace("T", " ").slice(0, 16);
  return iso;
}

export function rowToDto(row: BoardingHouseUserRow): BoardingHouseUserDto {
  const displayId = `U-${String(row.seq_id).padStart(3, "0")}`;
  const lastLogin = row.last_login_at
    ? formatDateTime(row.last_login_at)
    : "—";
  return {
    id: row.id,
    displayId,
    name: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    studentId: row.student_id?.trim() ? row.student_id.trim() : null,
    ictVerificationStatus: row.ict_verification_status || "Verified",
    emergencyContactName: row.emergency_contact_name?.trim() || null,
    emergencyContactPhone: row.emergency_contact_phone?.trim() || null,
    course: row.course?.trim() || null,
    createdDate: formatDate(row.created_at),
    lastLogin,
  };
}

export function isBoardingRole(v: string): v is BoardingRole {
  return (BOARDING_ROLES as readonly string[]).includes(v);
}

export function isBoardingStatus(v: string): v is BoardingStatus {
  return (BOARDING_STATUSES as readonly string[]).includes(v);
}

export function isIctVerificationStatus(v: string): v is IctVerificationStatus {
  return (ICT_VERIFICATION_STATUSES as readonly string[]).includes(v);
}
