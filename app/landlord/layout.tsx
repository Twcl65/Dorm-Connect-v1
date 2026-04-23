 "use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function LandlordLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="Landlord / Dorm Owner"
      sidebarItems={[
        { label: "Dashboard", href: "/landlord", icon: RoleIcons.dashboard },
        { label: "Rooms", href: "/landlord/rooms", icon: RoleIcons.rooms },
        { label: "Tenants", href: "/landlord/tenants", icon: RoleIcons.tenants },
        { label: "Reservations", href: "/landlord/reservations", icon: RoleIcons.reservations },
        { label: "Payments", href: "/landlord/payments", icon: RoleIcons.payments },
        { label: "Incident reports", href: "/landlord/incidents", icon: RoleIcons.reports },
        { label: "Announcements", href: "/landlord/announcements", icon: RoleIcons.announcements },
        { label: "Accreditation Documents", href: "/landlord/documents", icon: RoleIcons.documents },
        { label: "Account & settings", href: "/landlord/settings", icon: RoleIcons.settings }
      ]}
    >
      {children}
    </RoleShell>
  );
}

