export function formatLeasePeriod(start: Date, end: Date): string {
  const a = start.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const b = end.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `${a} - ${b}`;
}

export function reservationLifecycle(
  status: string,
  leaseEnd: Date,
  now = new Date()
): "Active" | "Completed" | "Cancelled" | "Pending" {
  if (status === "Cancelled") return "Cancelled";
  if (status === "Pending") return "Pending";
  if (status === "Confirmed") {
    const end = new Date(leaseEnd);
    end.setHours(23, 59, 59, 999);
    return end >= now ? "Active" : "Completed";
  }
  return "Pending";
}

export function landlordStatusToStudentApproved(
  status: string
): "Pending" | "Approved" | "Cancelled" {
  if (status === "Confirmed") return "Approved";
  if (status === "Cancelled") return "Cancelled";
  return "Pending";
}
