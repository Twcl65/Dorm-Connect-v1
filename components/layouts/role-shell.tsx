"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Settings,
  ClipboardList,
  ShieldCheck,
  Megaphone,
  BedDouble,
  UserCircle,
  CalendarClock,
  WalletCards,
  FileBadge,
  Bell,
  Menu,
  MoreVertical,
  User as UserIcon
} from "lucide-react";
import { cn } from "@/components/ui/utils";

export type SidebarItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type RoleShellProps = {
  roleLabel: string;
  sidebarItems: SidebarItem[];
  children: ReactNode;
  /** Optional override; otherwise loaded from `/api/auth/me` */
  userDisplayName?: string;
  userEmail?: string;
};

type MeUser = {
  name: string;
  email: string;
  role: string;
  profileImageUrl?: string | null;
};

export function RoleShell({
  roleLabel,
  sidebarItems,
  children,
  userDisplayName: userDisplayNameProp,
  userEmail: userEmailProp,
}: RoleShellProps) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);
  const pathname = usePathname() ?? "";
  const settingsHref = `/${pathname.split("/").filter(Boolean)[0] ?? ""}/settings`;

  useEffect(() => {
    if (userDisplayNameProp != null && userEmailProp != null) return;
    let cancelled = false;
    const load = () => {
      fetch("/api/auth/me", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { user?: MeUser } | null) => {
          if (!cancelled && data?.user) setMe(data.user);
        })
        .catch(() => {});
    };
    load();
    const onUpdated = () => {
      if (!cancelled) load();
    };
    window.addEventListener("dc-profile-updated", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("dc-profile-updated", onUpdated);
    };
  }, [userDisplayNameProp, userEmailProp]);

  const displayName =
    userDisplayNameProp ?? me?.name ?? roleLabel;
  const displayEmail =
    userEmailProp ?? me?.email ?? "";

  const initials = (displayName || roleLabel)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

  const activeItem =
    sidebarItems.find((item) => {
      const segments = item.href.split("/").filter(Boolean);
      const isRootItem = segments.length === 1;
      return isRootItem
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
    }) ?? sidebarItems[0];

  return (
    <div className="min-h-screen bg-muted">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-white text-slate-900">
          <div className="flex h-14 items-center gap-2 border-b border-[#031C2E] bg-[#031C2E] px-5 text-slate-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-white">DormConnect</p>
              <p className="text-[0.7rem] text-primary font-medium">
                {roleLabel}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-3 px-4 py-4 text-sm">
            <p className="px-1 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
              Main
            </p>
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon ?? LayoutDashboard;
                const segments = item.href.split("/").filter(Boolean);
                const isRootItem = segments.length === 1;
                const isActive = isRootItem
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[0.9rem] font-medium transition-colors",
                      isActive
                        ? "bg-[#031C2E] text-white shadow-sm"
                        : "text-slate-800 hover:bg-[#031C2E] hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200 bg-white px-4 py-3 text-[0.7rem] text-slate-500">
            <p>DormConnect v0.1 • USTP</p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Global header (same color as sidebar) */}
          <header className="hidden md:flex h-14 items-center justify-between border-b border-[#031C2E] bg-[#031C2E] px-6 text-slate-100">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center"
              >
                <Menu className="h-6 w-6" />
              </button>
              <p className="text-sm font-semibold tracking-tight">
                {activeItem?.label ?? roleLabel}
              </p>
            </div>

            <div className="relative flex items-center gap-2">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground text-[0.65rem] font-semibold ring-2 ring-white/10">
                {me?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={me.profileImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : me || userDisplayNameProp ? (
                  <span className="leading-none">{initials}</span>
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </div>
              <div className="hidden sm:flex flex-col leading-tight min-w-0 max-w-[200px]">
                <span className="text-xs font-medium truncate">{displayName}</span>
                {displayEmail ? (
                  <span className="text-[0.65rem] text-slate-300 truncate">
                    {displayEmail}
                  </span>
                ) : (
                  <span className="text-[0.65rem] text-slate-400 truncate">
                    {roleLabel}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen((open) => !open)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-slate-700 bg-[#031C2E] text-xs shadow-lg">
                  <Link
                    href={settingsHref}
                    className="block px-3 py-2 text-left text-slate-100 hover:bg-white/10"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    Account &amp; settings
                  </Link>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-rose-200 hover:bg-white/10"
                    onClick={() => {
                      setIsProfileOpen(false);
                      void fetch("/api/auth/logout", {
                        method: "POST",
                        credentials: "include",
                      }).finally(() => {
                        router.push("/login");
                        router.refresh();
                      });
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Mobile header */}
          <header className="relative flex md:hidden h-14 items-center justify-between gap-3 border-b border-[#031C2E] bg-[#031C2E] px-4 text-slate-100">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center"
              >
                <Menu className="h-6 w-6" />
              </button>
              <p className="text-sm font-semibold tracking-tight">
                {activeItem?.label ?? roleLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsProfileOpen((open) => !open)}
              className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground ring-2 ring-white/10"
            >
              {me?.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.profileImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-4 w-4" />
              )}
            </button>

            {isProfileOpen && (
              <div className="absolute right-3 top-12 z-50 w-48 rounded-md border border-slate-700 bg-[#031C2E] text-xs shadow-lg">
                <div className="border-b border-slate-600 px-3 py-2">
                  <p className="truncate font-medium text-slate-100">{displayName}</p>
                  {displayEmail ? (
                    <p className="truncate text-[0.65rem] text-slate-400">{displayEmail}</p>
                  ) : null}
                </div>
                <Link
                  href={settingsHref}
                  className="block px-3 py-2 text-left text-slate-100 hover:bg-white/10"
                  onClick={() => setIsProfileOpen(false)}
                >
                  Account &amp; settings
                </Link>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-rose-200 hover:bg-white/10"
                  onClick={() => {
                    setIsProfileOpen(false);
                    void fetch("/api/auth/logout", {
                      method: "POST",
                      credentials: "include",
                    }).finally(() => {
                      router.push("/login");
                      router.refresh();
                    });
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </header>

          <main className="flex-1 bg-muted px-4 py-4 sm:px-6 sm:py-6 md:px-6 lg:px-8">
            <div className="max-w-6xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Export some icons to reuse when building menus
export const RoleIcons = {
  dashboard: LayoutDashboard,
  users: Users,
  dorms: BedDouble,
  reports: FileText,
  settings: Settings,
  accreditation: ClipboardList,
  safety: ShieldCheck,
  monitoring: Building2,
  announcements: Megaphone,
  rooms: BedDouble,
  tenants: UserCircle,
  reservations: CalendarClock,
  payments: WalletCards,
  documents: FileBadge,
  bell: Bell
};

