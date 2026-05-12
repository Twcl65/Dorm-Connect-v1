"use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function OsaLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="OSA / SAS Administrator"
      sidebarItems={[
        { label: "Dashboard", href: "/osa", icon: RoleIcons.dashboard },
        { label: "Accreditation", href: "/osa/accreditation", icon: RoleIcons.accreditation },
        { label: "Tenant Monitoring", href: "/osa/tenants", icon: RoleIcons.users },
        { label: "Safety & Compliance", href: "/osa/safety", icon: RoleIcons.safety },
        { label: "Dorm Monitoring", href: "/osa/monitoring", icon: RoleIcons.monitoring },
        {
          label: "Accreditation monitoring",
          href: "/osa/accreditation-monitoring",
          icon: RoleIcons.dashboard,
        },
        { label: "Announcements", href: "/osa/announcements", icon: RoleIcons.announcements },
        { label: "Account & settings", href: "/osa/settings", icon: RoleIcons.settings }
      ]}
    >
      {children}
    </RoleShell>
  );
}

