"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, UserX, Edit3, Eye, Loader2 } from "lucide-react";
import type { BoardingHouseUserDto } from "@/lib/boarding-house-users";

function countByRole(users: BoardingHouseUserDto[], role: string): number {
  return users.filter((u) => u.role === role).length;
}

type SystemStats = {
  dormitories: number;
  rooms: number;
  studentReservations: number;
  landlordReservations: number;
  accredited: number;
  pendingAccreditation: number;
};

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<BoardingHouseUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [selectedUser, setSelectedUser] = useState<BoardingHouseUserDto | null>(
    null
  );
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("Student");
  const [formStatus, setFormStatus] = useState("Active");

  const loadUsers = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = (await res.json()) as {
        users?: BoardingHouseUserDto[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load users.");
      }
      setUsers(data.users ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSystemStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      const data = (await res.json()) as SystemStats & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load system stats.");
      }
      setSystemStats({
        dormitories: data.dormitories,
        rooms: data.rooms,
        studentReservations: data.studentReservations,
        landlordReservations: data.landlordReservations,
        accredited: data.accredited,
        pendingAccreditation: data.pendingAccreditation,
      });
    } catch {
      setSystemStats(null);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadSystemStats();
  }, [loadUsers, loadSystemStats]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "Active").length;
    const pending = users.filter((u) => u.status === "Pending").length;
    const inactive = users.filter((u) => u.status === "Inactive").length;
    return {
      total,
      active,
      pending,
      inactive,
      ictAdmin: countByRole(users, "ICT Admin"),
      osa: countByRole(users, "OSA Admin"),
      owners: countByRole(users, "Owner"),
      students: countByRole(users, "Student"),
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.displayId.toLowerCase().includes(q);
      const matchesRole =
        roleFilter === "All roles" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "All statuses" || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const submitEdit = async () => {
    if (!selectedUser) return;
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          role: formRole,
          status: formStatus,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update user.");
      }
      setShowEditDialog(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not update user.");
    } finally {
      setSaving(false);
    }
  };

  const userCards = [
    {
      label: "ICT Admin",
      value: String(stats.ictAdmin),
      badge: "Registered",
      badgeVariant: "secondary" as const,
    },
    {
      label: "OSA Admin",
      value: String(stats.osa),
      badge: "Registered",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Landlords",
      value: String(stats.owners),
      badge: "Registered",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Students",
      value: String(stats.students),
      badge: "Registered",
      badgeVariant: "secondary" as const,
    },
  ];

  const systemOverviewCards = [
    {
      label: "Dormitories",
      value: String(systemStats?.dormitories ?? "—"),
      badge: "Properties",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Rooms listed",
      value: String(systemStats?.rooms ?? "—"),
      badge: "Inventory",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Student reservations",
      value: String(systemStats?.studentReservations ?? "—"),
      badge: "Flow",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Landlord reservations",
      value: String(systemStats?.landlordReservations ?? "—"),
      badge: "Manual",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Accredited (records)",
      value: String(systemStats?.accredited ?? "—"),
      badge: "OSA",
      badgeVariant: "success" as const,
    },
    {
      label: "Accreditation queue",
      value: String(systemStats?.pendingAccreditation ?? "—"),
      badge: "Pending",
      badgeVariant: "warning" as const,
    },
  ];

  const overviewCards = [
    {
      label: "Total users",
      value: String(stats.total),
      badge: "All roles",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Active",
      value: String(stats.active),
      badge: "Status",
      badgeVariant: "success" as const,
    },
    {
      label: "Pending",
      value: String(stats.pending),
      badge: "Status",
      badgeVariant: "warning" as const,
    },
    {
      label: "Inactive",
      value: String(stats.inactive),
      badge: "Status",
      icon: UserX,
      badgeVariant: "muted" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">
            ICT Dashboard
          </h3>
          <p className="text-sm text-black font-normal">
            Overview of system activity and registered accounts.
          </p>
        </div>
      </div>

      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {listError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {userCards.map((card) => (
          <Card
            key={card.label}
            className="border border-gray-300 bg-white"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {loading ? "—" : card.value}
              </p>
              <Badge
                variant={card.badgeVariant}
                className="text-[0.7rem]"
              >
                {card.badge}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <Card
            key={card.label}
            className="border border-gray-300 bg-white shadow-sm"
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {loading ? "—" : card.value}
              </p>
              <Badge
                variant={card.badgeVariant}
                className="text-[0.7rem]"
              >
                {card.badge}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <h4 className="text-sm font-semibold text-slate-800">
        DormConnect operations
      </h4>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {systemOverviewCards.map((card) => (
          <Card
            key={card.label}
            className="border border-gray-300 bg-white shadow-sm"
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {card.value}
              </p>
              <Badge
                variant={card.badgeVariant}
                className="text-[0.7rem]"
              >
                {card.badge}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Registered Users
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                List of all registered users.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search name or email..."
                className="h-8 w-40 sm:w-56 text-xs bg-muted"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option>All roles</option>
                <option>ICT Admin</option>
                <option>OSA Admin</option>
                <option value="Owner">Landlord (Owner)</option>
                <option>Student</option>
              </select>
              <select
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All statuses</option>
                <option>Active</option>
                <option>Pending</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users…
            </div>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-4 font-semibold text-slate-600">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {user.displayId}
                      </TableCell>
                      <TableCell>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {user.role === "Owner" ? "Landlord" : user.role}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "Active"
                              ? "success"
                              : user.status === "Pending"
                                ? "warning"
                                : "muted"
                          }
                          className="text-[0.7rem]"
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                            onClick={() => {
                              setFormError(null);
                              setSelectedUser(user);
                              setFormName(user.name);
                              setFormEmail(user.email);
                              setFormRole(user.role);
                              setFormStatus(user.status);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.7rem] text-muted-foreground">
              {loading
                ? " "
                : `Showing ${filteredUsers.length} of ${users.length} user${users.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {showEditDialog && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Edit User
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowEditDialog(false)}
                  disabled={saving}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-slate-800">
              {formError && (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[0.7rem] text-red-800">
                  {formError}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-[90px,1fr] items-center">
                <span className="text-[0.7rem]">User ID</span>
                <Input
                  value={selectedUser.displayId}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Full Name</span>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-8 text-xs"
                  disabled={saving}
                />
                <span className="text-[0.7rem]">Email</span>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="h-8 text-xs"
                  disabled={saving}
                />
                <span className="text-[0.7rem]">Role</span>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  disabled={saving}
                >
                  <option value="Student">Student</option>
                  <option value="Owner">Landlord (Owner)</option>
                  <option value="ICT Admin">ICT Admin</option>
                  <option value="OSA Admin">OSA Admin</option>
                </select>
                <span className="text-[0.7rem]">Status</span>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  disabled={saving}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <span className="text-[0.7rem]">Created Date</span>
                <Input
                  value={selectedUser.createdDate}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Last Login</span>
                <Input
                  value={selectedUser.lastLogin}
                  readOnly
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowEditDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => void submitEdit()}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDetailsDialog && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  User Details
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-slate-800">
              <div className="grid gap-2 md:grid-cols-[90px,1fr] items-center">
                <span className="text-[0.7rem]">User ID</span>
                <Input
                  value={selectedUser.displayId}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Full Name</span>
                <Input
                  value={selectedUser.name}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Email</span>
                <Input
                  value={selectedUser.email}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Role</span>
                <Input
                  value={selectedUser.role}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Status</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedUser.status === "Active"
                        ? "success"
                        : selectedUser.status === "Pending"
                          ? "warning"
                          : "muted"
                    }
                    className="text-[0.7rem]"
                  >
                    {selectedUser.status}
                  </Badge>
                </div>
                <span className="text-[0.7rem]">Created Date</span>
                <Input
                  value={selectedUser.createdDate}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Last Login</span>
                <Input
                  value={selectedUser.lastLogin}
                  readOnly
                  className="h-8 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
