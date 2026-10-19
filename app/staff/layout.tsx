"use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="Staff"
      showSettings={false}
      sidebarItems={[
        { label: "Dashboard", href: "/staff", icon: RoleIcons.dashboard },
        { label: "Inspections", href: "/staff/inspections", icon: RoleIcons.safety },
        { label: "Accreditation monitoring", href: "/staff/accreditation-monitoring", icon: RoleIcons.accreditation },
        { label: "Tenant monitoring", href: "/staff/tenants", icon: RoleIcons.users },
      ]}
    >
      {children}
    </RoleShell>
  );
}
