import type { DueUrgency } from "@/lib/payment-schedule";

export function studentStayLabel(
  lifecycle: "Active" | "Completed" | "Cancelled" | "Pending"
): "Pending" | "Current Staying" | "Move Out" {
  if (lifecycle === "Pending") return "Pending";
  if (lifecycle === "Active") return "Current Staying";
  return "Move Out";
}

export function studentRentLabel(
  urgency: DueUrgency | null,
  fallbackStatus: string
): "Paid" | "Due Soon" | "Overdue" | "Due" | "Not Yet Due" {
  if (urgency === "paid" || fallbackStatus === "Paid") return "Paid";
  if (urgency === "overdue" || fallbackStatus === "Overdue") return "Overdue";
  if (urgency === "due_today") return "Due";
  if (urgency === "due_soon") return "Due Soon";
  return "Not Yet Due";
}
