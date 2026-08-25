 "use client";

import { ReactNode } from "react";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function LandlordLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="Landlord / Dorm Owner"
      sidebarItems={[
        { label: "Dashboard", href: "/landlord", icon: RoleIcons.dashboard },
        { label: "Rooms Management", href: "/landlord/rooms-management", icon: RoleIcons.rooms },
        { label: "Reservations & Payments", href: "/landlord/reservations", icon: RoleIcons.reservations },
        { label: "View Reviews", href: "/landlord/reviews", icon: RoleIcons.reviews },
        { label: "Reports Management", href: "/landlord/incidents", icon: RoleIcons.reports },
        { label: "Announcements", href: "/landlord/announcements", icon: RoleIcons.announcements },
        { label: "Accreditation Documents", href: "/landlord/documents", icon: RoleIcons.documents },
        { label: "Account & settings", href: "/landlord/settings", icon: RoleIcons.settings }
      ]}
    >
      {children}
    </RoleShell>
  );
}

