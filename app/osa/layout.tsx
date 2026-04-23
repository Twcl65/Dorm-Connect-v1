"use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function OsaLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="OSA Administrator"
      sidebarItems={[
        { label: "Dashboard", href: "/osa", icon: RoleIcons.dashboard },
        { label: "Accreditation", href: "/osa/accreditation", icon: RoleIcons.accreditation },
        { label: "Safety & Compliance", href: "/osa/safety", icon: RoleIcons.safety },
        { label: "Dorm Monitoring", href: "/osa/monitoring", icon: RoleIcons.monitoring },
        { label: "Announcements", href: "/osa/announcements", icon: RoleIcons.announcements },
        { label: "Account & settings", href: "/osa/settings", icon: RoleIcons.settings }
      ]}
    >
      {children}
    </RoleShell>
  );
}

