"use client";

import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface LeasePaymentMonitoringCardProps {
  tenantName: string;
  roomNumber: string;
  leaseDuration: string;
  monthlyRent: number;
  leaseStartDate: string;
  leaseEndDate: string;
  remainingBalance: number;
  advancePayments: number;
  deposits: number;
  monthlySchedule: { status: "Paid" | "Not Yet Paid" }[];
  onViewDetails?: () => void;
  onNotifyTenant?: () => void;
}

export function LeasePaymentMonitoringCard({
  tenantName,
  roomNumber,
  leaseDuration,
  monthlyRent,
  leaseStartDate,
  leaseEndDate,
  remainingBalance,
  advancePayments,
  deposits,
  monthlySchedule,
  onViewDetails,
  onNotifyTenant,
}: LeasePaymentMonitoringCardProps) {
  const paidMonths = monthlySchedule.filter((m) => m.status === "Paid").length;
  const totalMonths = monthlySchedule.length;

  return (
    <div className="rounded-xs border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">{tenantName}</p>
          <div className="flex flex-wrap gap-2 text-[0.7rem] text-muted-foreground">
            <span>Room {roomNumber}</span>
            <span>•</span>
            <span>{leaseDuration}</span>
            <span>•</span>
            <span>₱{monthlyRent.toLocaleString()} / month</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[0.75rem] text-slate-600">
          <span className="font-medium">
            {paidMonths} / {totalMonths} months paid
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-[0.7rem]">
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[0.7rem] gap-1 bg-red-500 text-white hover:bg-red-600"
            onClick={onNotifyTenant}
          >
            <Bell className="h-3 w-3" />
            Notify Tenant
          </Button>
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
