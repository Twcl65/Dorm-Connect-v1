"use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="ICT System Administrator"
      sidebarItems={[
        { label: "Dashboard", href: "/admin", icon: RoleIcons.dashboard },
        { label: "User Management", href: "/admin/users", icon: RoleIcons.users },
        { label: "Account & settings", href: "/admin/settings", icon: RoleIcons.settings },
      ]}
    >
      {children}
    </RoleShell>
  );
}

