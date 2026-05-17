/** Days before expiry when a new accreditation application may be submitted. */
export const ACCREDITATION_RENEWAL_LEAD_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PropertyAccreditationSnapshot = {
  status: string;
  submittedAt: Date | string;
  accreditationExpiresAt: Date | string | null | undefined;
};

export function effectiveAccreditationExpiry(
  submittedAt: Date | string,
  accreditationExpiresAt: Date | string | null | undefined
): Date {
  if (accreditationExpiresAt) return new Date(accreditationExpiresAt);
  const d = new Date(submittedAt);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** True when expiry is within the renewal lead window (or already past). */
export function isWithinAccreditationRenewalWindow(
  expiresAt: Date,
  now: Date = new Date()
): boolean {
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / MS_PER_DAY
  );
  return daysUntilExpiry <= ACCREDITATION_RENEWAL_LEAD_DAYS;
}

export function canApplyForPropertyAccreditation(
  latest: PropertyAccreditationSnapshot | null | undefined
): boolean {
  if (!latest) return true;

  const { status } = latest;
  if (status === "Expired" || status === "Rejected") return true;

  if (status === "Approved") {
    const expiry = effectiveAccreditationExpiry(
      latest.submittedAt,
      latest.accreditationExpiresAt
    );
    return isWithinAccreditationRenewalWindow(expiry);
  }

  return false;
}

export function accreditationApplicationBlockReason(
  latest: PropertyAccreditationSnapshot | null | undefined
): string | null {
  if (!latest || canApplyForPropertyAccreditation(latest)) return null;

  if (latest.status === "Approved") {
    const expiry = effectiveAccreditationExpiry(
      latest.submittedAt,
      latest.accreditationExpiresAt
    );
    return `Accreditation is approved until ${expiry.toISOString().slice(0, 10)}. You may apply again within ${ACCREDITATION_RENEWAL_LEAD_DAYS} days of expiry.`;
  }

  return `An accreditation application for this property is already ${latest.status.toLowerCase()}.`;
}
