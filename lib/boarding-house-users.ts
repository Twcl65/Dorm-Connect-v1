export const BOARDING_ROLES = [
  "Student",
  "Owner",
  "ICT Admin",
  "OSA Admin",
] as const;

export const BOARDING_STATUSES = ["Active", "Pending", "Inactive"] as const;

export type BoardingRole = (typeof BOARDING_ROLES)[number];
export type BoardingStatus = (typeof BOARDING_STATUSES)[number];

export type BoardingHouseUserRow = {
  id: string;
  seq_id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  student_id: string | null;
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
