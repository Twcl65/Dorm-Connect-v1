"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit3, Eye, Loader2 } from "lucide-react";
import type { BoardingHouseUserDto } from "@/lib/boarding-house-users";
import {
  PasswordInputWithToggle,
  ViewPasswordPlaceholder,
} from "@/components/password-input-with-toggle";

function randomTempPassword(): string {
  return `TEMP-${Math.floor(100000 + Math.random() * 900000)}`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<BoardingHouseUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<BoardingHouseUserDto | null>(
    null
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("Student");
  const [formStatus, setFormStatus] = useState("Active");
  const [formTempPassword, setFormTempPassword] = useState("");
  const [formStudentId, setFormStudentId] = useState("");
  const [formIctVerification, setFormIctVerification] =
    useState("Verified");
  const [formNewPassword, setFormNewPassword] = useState("");

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

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.displayId.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q));
      const matchesRole =
        roleFilter === "All roles" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "All statuses" || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const openAdd = () => {
    setFormError(null);
    setFormName("");
    setFormEmail("");
    setFormRole("Student");
    setFormStatus("Active");
    setFormTempPassword(randomTempPassword());
    setFormStudentId("");
    setFormIctVerification("Verified");
    setShowAddDialog(true);
  };

  const submitAdd = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          role: formRole,
          status: formStatus,
          temporaryPassword: formTempPassword,
          studentId: formStudentId.trim() || undefined,
          ...(formRole === "Student"
            ? { ictVerificationStatus: formIctVerification }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        user?: BoardingHouseUserDto;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not add user.");
      }
      setShowAddDialog(false);
      await loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not add user.");
    } finally {
      setSaving(false);
    }
  };

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
          studentId: formStudentId.trim() ? formStudentId.trim() : null,
          newPassword: formNewPassword.trim() || undefined,
          ...(formRole === "Student"
            ? { ictVerificationStatus: formIctVerification }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        user?: BoardingHouseUserDto;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update user.");
      }
      setShowEditDialog(false);
      setSelectedUser(null);
      setFormNewPassword("");
      await loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not update user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">
            User Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage system accounts, roles, and access.
          </p>
        </div>
        <Button
          size="sm"
          className="flex items-center gap-1 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
          onClick={openAdd}
          disabled={loading}
        >
          Add User
        </Button>
      </div>

      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {listError}
        </div>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Registered Users
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Recently added users across all roles.
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
                <option>OSA/SAS Admin</option>
                <option>Landlord</option>
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
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
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
                <TableHead>Student ID</TableHead>
                <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ICT verify</TableHead>
                  <TableHead className="text-right pr-4 font-semibold text-slate-600">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
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
                      <TableCell className="text-xs font-mono text-slate-600">
                        {user.studentId ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {user.role}
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
                      <TableCell className="text-[0.65rem] text-slate-600">
                        {user.role === "Student"
                          ? user.ictVerificationStatus
                          : "—"}
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
                              setFormIctVerification(user.ictVerificationStatus);
                              setFormStudentId(user.studentId ?? "");
                              setFormNewPassword("");
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
                            View Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="my-auto flex w-full max-h-[min(90vh,calc(100dvh-2rem))] max-w-md flex-col overflow-hidden border border-gray-300 bg-white">
            <CardHeader className="shrink-0 pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Add User
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowAddDialog(false)}
                  disabled={saving}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4 text-xs text-slate-800">
              {formError && (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[0.7rem] text-red-800">
                  {formError}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-[90px,1fr] items-center">
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
                  <option value="Landlord">Landlord</option>
                  <option value="ICT Admin">ICT Admin</option>
                  <option value="OSA/SAS Admin">OSA/SAS Admin</option>
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
                {formRole === "Student" && (
                  <>
                    <span className="text-[0.7rem]">ICT verification</span>
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={formIctVerification}
                      onChange={(e) => setFormIctVerification(e.target.value)}
                      disabled={saving}
                    >
                      <option value="Pending Verification">
                        Pending Verification
                      </option>
                      <option value="Verified">Verified</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </>
                )}
                <span className="text-[0.7rem]">Student ID</span>
                <Input
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="h-8 text-xs"
                  disabled={saving}
                  placeholder="Optional (school ID)"
                />
                <span className="text-[0.7rem]">Temporary Password</span>
                <PasswordInputWithToggle
                  value={formTempPassword}
                  onChange={(e) => setFormTempPassword(e.target.value)}
                  className="font-mono"
                  disabled={saving}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <p className="text-[0.65rem] text-muted-foreground">
                Password is stored hashed. Share the temporary password with the
                user securely; they should change it after first login if you add
                sign-in later.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowAddDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={() => void submitAdd()}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save User"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showEditDialog && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="my-auto flex w-full max-h-[min(90vh,calc(100dvh-2rem))] max-w-md flex-col overflow-hidden border border-gray-300 bg-white">
            <CardHeader className="shrink-0 pb-2 border-b bg-muted/40">
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
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4 text-xs text-slate-800">
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
                  <option value="Landlord">Landlord</option>
                  <option value="ICT Admin">ICT Admin</option>
                  <option value="OSA/SAS Admin">OSA/SAS Admin</option>
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
                {formRole === "Student" && (
                  <>
                    <span className="text-[0.7rem]">ICT verification</span>
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={formIctVerification}
                      onChange={(e) => setFormIctVerification(e.target.value)}
                      disabled={saving}
                    >
                      <option value="Pending Verification">
                        Pending Verification
                      </option>
                      <option value="Verified">Verified</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </>
                )}
                <span className="text-[0.7rem]">Student ID</span>
                <Input
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="h-8 text-xs"
                  disabled={saving}
                />
                <span className="text-[0.7rem]">New password</span>
                <PasswordInputWithToggle
                  value={formNewPassword}
                  onChange={(e) => setFormNewPassword(e.target.value)}
                  placeholder="Leave blank to keep"
                  autoComplete="new-password"
                  disabled={saving}
                />
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="my-auto flex w-full max-h-[min(90vh,calc(100dvh-2rem))] max-w-md flex-col overflow-hidden border border-gray-300 bg-white">
            <CardHeader className="shrink-0 pb-2 border-b bg-muted/40">
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
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4 text-xs text-slate-800">
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
                <span className="text-[0.7rem]">Student ID</span>
                <Input
                  value={selectedUser.studentId ?? "—"}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Password</span>
                <ViewPasswordPlaceholder />
                <p className="md:col-span-2 text-[0.65rem] text-muted-foreground -mt-1">
                  Toggle the eye to see why the password cannot be displayed.
                  Use Edit to set a new password.
                </p>
                <span className="text-[0.7rem]">Role</span>
                <Input
                  value={selectedUser.role}
                  readOnly
                  className="h-8 text-xs"
                />
                {selectedUser.role === "Student" && (
                  <>
                    <span className="text-[0.7rem]">ICT verification</span>
                    <Input
                      value={selectedUser.ictVerificationStatus}
                      readOnly
                      className="h-8 text-xs"
                    />
                  </>
                )}
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
