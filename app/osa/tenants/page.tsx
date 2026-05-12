"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";

type Tenant = {
  studentId: string;
  name: string;
  email: string;
  schoolId: string | null;
  course: string | null;
  dormName: string;
  roomNo: string;
  landlordName: string;
  leaseStart: string;
  leaseEnd: string;
  occupancy: string;
};

export default function OsaTenantsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/osa/tenants?q=${encodeURIComponent(q.trim())}`,
        { credentials: "include" }
      );
      const data = (await res.json()) as { tenants?: Tenant[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setTenants(data.tenants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tenant monitoring</h2>
        <p className="text-sm text-muted-foreground">
          Search confirmed tenants by name, email, or school ID. For parents and
          school staff locating students.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            className="max-w-md h-9 text-sm"
            placeholder="At least 2 characters…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void search()}
          />
          <Button
            size="sm"
            className="h-9 gap-1"
            onClick={() => void search()}
            disabled={loading || q.trim().length < 2}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Boarding house</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Landlord</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {q.trim().length < 2
                      ? "Enter a search to see results."
                      : "No matching tenants."}
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((t) => (
                  <TableRow key={`${t.studentId}-${t.dormName}-${t.roomNo}`}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-[0.65rem] text-muted-foreground">
                        {t.email}
                      </div>
                      <div className="text-[0.65rem]">
                        ID: {t.schoolId ?? "—"} · {t.course ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{t.dormName}</TableCell>
                    <TableCell className="text-xs font-mono">{t.roomNo}</TableCell>
                    <TableCell className="text-xs">{t.landlordName}</TableCell>
                    <TableCell className="text-xs">
                      {t.leaseStart} → {t.leaseEnd}
                    </TableCell>
                    <TableCell className="text-xs">{t.occupancy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
