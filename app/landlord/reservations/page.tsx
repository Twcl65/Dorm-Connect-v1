"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionTabBar } from "@/components/landlord/section-tab-bar";
import type { ReservationsManagementTab } from "@/components/landlord/rooms-management-types";
import { LandlordPaymentsPanel } from "@/components/landlord/landlord-payments-panel";
import { LandlordReservationsPanel } from "@/components/landlord/landlord-reservations-panel";

const RESERVATION_TABS: { id: ReservationsManagementTab; label: string }[] = [
  { id: "reservations", label: "Reservations" },
  { id: "payments", label: "Payments" },
];

function parseReservationsTab(value: string | null): ReservationsManagementTab {
  if (value === "payments") return value;
  return "reservations";
}

function ReservationsManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = parseReservationsTab(searchParams?.get("tab") ?? null);

  const setTab = useCallback(
    (tab: ReservationsManagementTab) => {
      const qs = tab === "reservations" ? "" : `?tab=${tab}`;
      router.replace(`/landlord/reservations${qs}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reservations &amp; Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage student reservations and payment records from one place.
          </p>
        </div>
        <SectionTabBar tabs={RESERVATION_TABS} active={activeTab} onChange={setTab} />
      </div>

      {activeTab === "reservations" && <LandlordReservationsPanel embedded />}
      {activeTab === "payments" && <LandlordPaymentsPanel embedded />}
    </div>
  );
}

export default function LandlordReservationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reservations &amp; Payments
          </h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ReservationsManagementContent />
    </Suspense>
  );
}
