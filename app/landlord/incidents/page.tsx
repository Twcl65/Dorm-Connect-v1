"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionTabBar } from "@/components/landlord/section-tab-bar";
import type { ReportsManagementTab } from "@/components/landlord/rooms-management-types";
import { LandlordIncidentsPanel } from "@/components/landlord/incidents-panel";
import { LandlordDormReportsPanel } from "@/components/landlord/landlord-dorm-reports-panel";
import { LandlordActivityLogsPanel } from "@/components/landlord/activity-logs-panel";
import { TenantReportsPanel } from "@/components/landlord/tenant-reports-panel";

const TABS: { id: ReportsManagementTab; label: string }[] = [
  { id: "incidents", label: "Incident Report" },
  { id: "tenant-reports", label: "Tenant Reports" },
  { id: "dorm-reports", label: "Dorm Reports" },
  { id: "activity-logs", label: "Activity Logs" },
];

function parseTab(value: string | null): ReportsManagementTab {
  if (value === "dorm-reports" || value === "activity-logs" || value === "tenant-reports") return value;
  return "incidents";
}

function ReportsManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = parseTab(searchParams?.get("tab") ?? null);

  const setTab = useCallback(
    (tab: ReportsManagementTab) => {
      const qs = tab === "incidents" ? "" : `?tab=${tab}`;
      router.replace(`/landlord/incidents${qs}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            View incident reports, dorm operation reports, and activity logs.
          </p>
        </div>
        <SectionTabBar tabs={TABS} active={activeTab} onChange={setTab} />
      </div>

      {activeTab === "incidents" && <LandlordIncidentsPanel embedded />}
      {activeTab === "tenant-reports" && <TenantReportsPanel embedded />}
      {activeTab === "dorm-reports" && <LandlordDormReportsPanel embedded />}
      {activeTab === "activity-logs" && <LandlordActivityLogsPanel embedded />}
    </div>
  );
}

export default function LandlordIncidentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ReportsManagementContent />
    </Suspense>
  );
}
