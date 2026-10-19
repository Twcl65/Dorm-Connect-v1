"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

interface LeasePaymentMonitoringCardProps {
  tenantName: string;
  roomNumber: string;
  propertyName?: string;
  leaseDuration: string;
  monthlyRent: number;
  leaseStartDate: string;
  leaseEndDate: string;
  remainingBalance: number;
  advancePayments: number;
  deposits: number;
  monthlySchedule: {
    monthNumber: number;
    dueDate: string;
    status: "Paid" | "Not Yet Paid";
    amount: number;
    paidDate?: string;
  }[];
  nextUnpaidReminderSent?: boolean;
  onViewDetails?: () => void;
  onNotifyTenant?: () => void;
}

export function LeasePaymentMonitoringCard({
  tenantName,
  roomNumber,
  propertyName,
  leaseDuration,
  monthlyRent,
  leaseStartDate,
  leaseEndDate,
  remainingBalance,
  advancePayments,
  deposits,
  monthlySchedule,
  nextUnpaidReminderSent = false,
  onViewDetails,
  onNotifyTenant,
}: LeasePaymentMonitoringCardProps) {
  const paidMonths = monthlySchedule.filter((m) => m.status === "Paid").length;
  const totalMonths = monthlySchedule.length;
  const hasUnpaid = monthlySchedule.some((m) => m.status !== "Paid");

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">{tenantName}</p>
        </div>
      </div>

  

      <div className="flex flex-wrap items-end gap-x-2 gap-y-0 text-[0.7rem]">
        <div className="min-w-[7rem]">
          <p className="text-muted-foreground">Remaining Balance</p>
          <p className="font-semibold text-slate-900">
            ₱{remainingBalance.toLocaleString()}
          </p>
        </div>
        <div className="min-w-[7rem]">
          <p className="text-muted-foreground">Advance Payments</p>
          <p className="font-semibold text-slate-900">
            ₱{advancePayments.toLocaleString()}
          </p>
        </div>
        <div className="min-w-[7rem]">
          <p className="text-muted-foreground">Deposits</p>
          <p className="font-semibold text-slate-900">
            ₱{deposits.toLocaleString()}
          </p>
        </div>
        <div className="min-w-[8rem]">
          <p className="text-muted-foreground">Lease Period</p>
          <p className="font-semibold text-slate-900 text-[0.65rem]">
            {new Date(leaseStartDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            -{" "}
            {new Date(leaseEndDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 ml-auto">
          {nextUnpaidReminderSent ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[0.7rem] gap-1 border-emerald-500 bg-emerald-50 text-emerald-800 cursor-default"
              disabled
            >
              Notified successfully for this month
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[0.7rem] gap-1 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              onClick={onNotifyTenant}
              disabled={!hasUnpaid || !onNotifyTenant}
            >
              <Bell className="h-3 w-3" />
              Notify Tenant
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[0.7rem] bg-blue-400 text-white hover:bg-blue-500"
            onClick={onViewDetails}
          >
            View All Payments
          </Button>
        </div>
      </div>
    </div>
  );
}
