"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionTabBar } from "@/components/landlord/section-tab-bar";
import type { RoomsManagementTab } from "@/components/landlord/rooms-management-types";
import { LandlordRoomsPanel } from "@/app/landlord/rooms/page";
import { LandlordPropertiesPanel } from "@/app/landlord/properties/page";
import { LandlordTenantsPanel } from "@/app/landlord/tenants/page";

const TABS: { id: RoomsManagementTab; label: string }[] = [
  { id: "rooms", label: "Rooms" },
  { id: "properties", label: "Properties" },
  { id: "tenants", label: "Tenants" },
];

function parseTab(value: string | null): RoomsManagementTab {
  if (value === "properties" || value === "tenants") return value;
  return "rooms";
}

function RoomsManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = parseTab(searchParams?.get("tab") ?? null);

  const setTab = useCallback(
    (tab: RoomsManagementTab) => {
      const qs = tab === "rooms" ? "" : `?tab=${tab}`;
      router.replace(`/landlord/rooms-management${qs}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Rooms Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage rooms, properties, and tenants from one place.
          </p>
        </div>
        <SectionTabBar tabs={TABS} active={activeTab} onChange={setTab} />
      </div>

      {activeTab === "rooms" && (
        <LandlordRoomsPanel embedded onSwitchTab={setTab} />
      )}
      {activeTab === "properties" && (
        <LandlordPropertiesPanel embedded onSwitchTab={setTab} />
      )}
      {activeTab === "tenants" && <LandlordTenantsPanel embedded />}
    </div>
  );
}

export default function LandlordRoomsManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Rooms Management
          </h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <RoomsManagementContent />
    </Suspense>
  );
}
