/** OSA on-site verification checklist (encoded per inspection record). */
export const OSA_INSPECTION_CHECKLIST = [
  {
    key: "fireExtinguisher",
    label: "Fire extinguisher present and accessible",
    category: "Fire safety",
  },
  {
    key: "emergencyExits",
    label: "Emergency exits marked and unobstructed",
    category: "Fire safety",
  },
  {
    key: "sanitation",
    label: "Sanitation and cleanliness standards met",
    category: "Facilities",
  },
  {
    key: "electricalSafety",
    label: "Electrical wiring and outlets are safe",
    category: "Facilities",
  },
  {
    key: "occupancyCompliance",
    label: "Occupancy limits and room capacity complied with",
    category: "Operations",
  },
  {
    key: "buildingPermit",
    label: "Valid building / business permits posted",
    category: "Documents",
  },
  {
    key: "fireSafetyCertificate",
    label: "Fire safety certificate on file",
    category: "Documents",
  },
  {
    key: "emergencyContactsPosted",
    label: "Emergency contacts posted for tenants",
    category: "Operations",
  },
] as const;

export type OsaChecklistKey = (typeof OSA_INSPECTION_CHECKLIST)[number]["key"];

export const DEFAULT_OSA_CHECKLIST: Record<OsaChecklistKey, boolean> =
  Object.fromEntries(
    OSA_INSPECTION_CHECKLIST.map((item) => [item.key, false])
  ) as Record<OsaChecklistKey, boolean>;

/** Landlord accreditation declaration (Step D – Safety & Compliance). */
export const LANDLORD_SAFETY_DECLARATION = [
  { key: "exits", label: "Marked emergency exits available" },
  { key: "extinguishers", label: "Fire extinguishers provided" },
  { key: "contacts", label: "Emergency contacts posted" },
  { key: "rooms", label: "Room safety checklist completed" },
] as const;

/** Landlord accreditation final declaration (Step E). */
export const LANDLORD_ACCREDITATION_DECLARATION = [
  {
    key: "certify",
    label:
      "I certify that all information provided in this application is true, complete, and accurate to the best of my knowledge.",
  },
  {
    key: "understandSubmit",
    label: "I understand that submission does not guarantee approval.",
  },
  {
    key: "understandRevoke",
    label:
      "I understand that accreditation may be revoked if compliance is violated.",
  },
  {
    key: "understandInspect",
    label: "I understand that OSA reserves the right to inspect the premises.",
  },
] as const;

export const INSPECTION_RESULTS = [
  "Recommended for Approval",
  "Rejected",
  "Hold",
] as const;

export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export function displayInspectionResult(result: string): string {
  if (result === "Hold") return "On Hold";
  return result;
}

export function parseLandlordSafetyDeclaration(
  formData: unknown
): Record<string, boolean> {
  if (!formData || typeof formData !== "object") return {};
  const safety = (formData as { safety?: Record<string, unknown> }).safety;
  if (!safety || typeof safety !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const item of LANDLORD_SAFETY_DECLARATION) {
    out[item.key] = safety[item.key] === true;
  }
  return out;
}

export function mergeChecklist(
  partial?: Record<string, boolean> | null
): Record<OsaChecklistKey, boolean> {
  return {
    ...DEFAULT_OSA_CHECKLIST,
    ...(partial && typeof partial === "object" ? partial : {}),
  } as Record<OsaChecklistKey, boolean>;
}
