 "use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="Student / Tenant"
      sidebarItems={[
        { label: "Dashboard", href: "/student", icon: RoleIcons.dashboard },
        { label: "Browse Dormitories", href: "/student/browse", icon: RoleIcons.dorms },
        { label: "My Reservations", href: "/student/reservations", icon: RoleIcons.reservations },
        { label: "Payments", href: "/student/payments", icon: RoleIcons.payments },
        { label: "Incident reports", href: "/student/incidents", icon: RoleIcons.reports },
        { label: "Announcements", href: "/student/announcements", icon: RoleIcons.announcements }
      ]}
    >
      {children}
    </RoleShell>
  );
}

