"use client";

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
import { Loader2, Search } from "lucide-react";
import { cn } from "@/components/ui/utils";

export type Boarder = {
  id: string;
  name: string;
  email?: string;
  schoolId?: string;
  course?: string;
  source: "student_app" | "manual_reservation" | "landlord_lease";
  occupancyStatus: string;
  leaseStart: string;
  leaseEnd: string;
  leasePeriod: string;
  roomNo?: string;
};

export type RoomOccupancy = {
  roomId: string;
  roomNo: string;
  capacity: number;
  monthlyRate: number;
  status: "Occupied" | "Available" | "Reserved" | "Maintenance";
  boarders: Boarder[];
};

export type OccupancySummary = {
  totalRooms: number;
  occupied: number;
  reserved: number;
  vacant: number;
  maintenance: number;
  totalBoarders: number;
};

type DormRow = {
  propertyId: string;
  dormName: string;
  ownerName: string;
};

function RoomStatusBadge({ status }: { status: string }) {
  const colorClasses =
    status === "Occupied"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Reserved"
        ? "bg-amber-100 text-amber-800"
        : status === "Maintenance"
          ? "bg-slate-200 text-slate-700"
          : "bg-sky-50 text-sky-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium`}
      variant="outline"
    >
      {status}
    </Badge>
  );
}

function sourceLabel(source: Boarder["source"]) {
  if (source === "student_app") return "Student app";
  if (source === "manual_reservation") return "Manual reservation";
  return "Landlord lease";
}

export type DormOccupancyDialogProps = {
  dorm: DormRow;
  occupancySummary: OccupancySummary | null;
  occupancyLoading: boolean;
  occupancyError: string | null;
  roomSearch: string;
  setRoomSearch: (v: string) => void;
  roomStatusFilter: "all" | RoomOccupancy["status"];
  setRoomStatusFilter: (v: "all" | RoomOccupancy["status"]) => void;
  paginatedRooms: RoomOccupancy[];
  filteredRooms: RoomOccupancy[];
  roomPage: number;
  setRoomPage: (fn: (p: number) => number) => void;
  roomTotalPages: number;
  roomsPerPage: number;
  onClose: () => void;
};

export function DormOccupancyDialog({
  dorm,
  occupancySummary,
  occupancyLoading,
  occupancyError,
  roomSearch,
  setRoomSearch,
  roomStatusFilter,
  setRoomStatusFilter,
  paginatedRooms,
  filteredRooms,
  roomPage,
  setRoomPage,
  roomTotalPages,
  roomsPerPage,
  onClose,
}: DormOccupancyDialogProps) {
  const roomFrom =
    filteredRooms.length === 0 ? 0 : (roomPage - 1) * roomsPerPage + 1;
  const roomTo = Math.min(roomPage * roomsPerPage, filteredRooms.length);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
      <Card className="w-full max-w-5xl border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Room occupancy — {dorm.dormName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dorm.ownerName} · Identify where each boarder is staying, room
                by room.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[0.7rem] shrink-0"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
          {occupancySummary && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                {
                  label: "Total rooms",
                  value: occupancySummary.totalRooms,
                  className: "bg-slate-100 text-slate-800",
                },
                {
                  label: "Occupied",
                  value: occupancySummary.occupied,
                  className: "bg-emerald-100 text-emerald-800",
                },
                {
                  label: "Reserved",
                  value: occupancySummary.reserved,
                  className: "bg-amber-100 text-amber-800",
                },
                {
                  label: "Vacant",
                  value: occupancySummary.vacant,
                  className: "bg-sky-50 text-sky-800",
                },
                {
                  label: "Boarders",
                  value: occupancySummary.totalBoarders,
                  className: "bg-violet-100 text-violet-800",
                },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[0.65rem] font-medium",
                    chip.className
                  )}
                >
                  {chip.label}: {chip.value}
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-xs text-slate-800">
          {occupancyError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              {occupancyError}
            </div>
          )}

          <section className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.75rem] font-semibold text-slate-900">
                Rooms occupied (per room)
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search room or boarder…"
                    className="h-8 w-full pl-7 text-xs sm:w-52"
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-36"
                  value={roomStatusFilter}
                  onChange={(e) =>
                    setRoomStatusFilter(
                      e.target.value as "all" | RoomOccupancy["status"]
                    )
                  }
                >
                  <option value="all">All rooms</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Available">Vacant</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
            </div>

            {occupancyLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading room occupancy…
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <Table bordered={false}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Room</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-16">Cap.</TableHead>
                        <TableHead>Boarder / tenant</TableHead>
                        <TableHead>ID & contact</TableHead>
                        <TableHead>Lease</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRooms.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No rooms match your search.
                          </TableCell>
                        </TableRow>
                      )}
                      {paginatedRooms.map((room) => (
                        <TableRow key={room.roomId}>
                          <TableCell className="font-semibold text-slate-900">
                            {room.roomNo}
                          </TableCell>
                          <TableCell>
                            <RoomStatusBadge status={room.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {room.capacity}
                          </TableCell>
                          <TableCell>
                            {room.boarders.length === 0 ? (
                              <span className="text-muted-foreground italic">
                                Vacant — no boarder assigned
                              </span>
                            ) : (
                              room.boarders.map((b) => (
                                <div key={b.id} className="space-y-0.5">
                                  <p className="font-medium text-slate-900">
                                    {b.name}
                                  </p>
                                  <p className="text-[0.65rem] text-muted-foreground">
                                    {sourceLabel(b.source)} · {b.occupancyStatus}
                                  </p>
                                </div>
                              ))
                            )}
                          </TableCell>
                          <TableCell>
                            {room.boarders.length === 0 ? (
                              <span>—</span>
                            ) : (
                              room.boarders.map((b) => (
                                <div key={b.id} className="space-y-0.5">
                                  {b.schoolId && <p>ID: {b.schoolId}</p>}
                                  {b.email && (
                                    <p className="text-muted-foreground">
                                      {b.email}
                                    </p>
                                  )}
                                  {b.course && (
                                    <p className="text-muted-foreground">
                                      {b.course}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </TableCell>
                          <TableCell className="text-[0.65rem] text-muted-foreground">
                            {room.boarders.length === 0
                              ? "—"
                              : room.boarders.map((b) => (
                                  <p key={b.id}>{b.leasePeriod}</p>
                                ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[0.7rem] text-muted-foreground">
                    Showing {roomFrom}–{roomTo} of {filteredRooms.length} rooms
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[0.7rem]"
                      disabled={roomPage === 1}
                      onClick={() => setRoomPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-[0.7rem]">
                      {roomPage} / {roomTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[0.7rem]"
                      disabled={roomPage === roomTotalPages}
                      onClick={() =>
                        setRoomPage((p) => Math.min(roomTotalPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

