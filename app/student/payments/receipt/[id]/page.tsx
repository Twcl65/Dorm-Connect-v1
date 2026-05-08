"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LineItem = { label: string; amount: number };

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  dormName: string;
  roomNo: string;
  landlord: string;
  leasePeriod: string;
  studentName: string;
  monthlyRent: number | null;
  lineItems: LineItem[] | null;
  notes: string | null;
};

export default function PaymentReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/student/payments/${id}`, {
        credentials: "include",
      });
      const j = (await res.json()) as { payment?: Payment; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to load");
      setPayment(j.payment ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPayment(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-lg mx-auto space-y-4 print:max-w-none">
      <div className="flex gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => window.print()}
          disabled={!payment}
        >
          Print / Save as PDF
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => router.push("/student/payments")}
        >
          Back
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-700">{error}</p>
      )}

      {payment && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:shadow-none print:border-0">
          <div className="text-center border-b border-slate-200 pb-4 mb-6">
            <h1 className="text-lg font-semibold tracking-tight">DormConnect</h1>
            <p className="text-xs text-muted-foreground">Payment receipt</p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Receipt No.</dt>
              <dd className="font-mono text-xs">{payment.id.slice(0, 8).toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd>
                {payment.paidAt
                  ? new Date(payment.paidAt).toLocaleDateString()
                  : new Date(payment.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Student</dt>
              <dd className="text-right">{payment.studentName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dorm / Room</dt>
              <dd className="text-right">
                {payment.dormName} — {payment.roomNo}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Landlord</dt>
              <dd className="text-right">{payment.landlord}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Lease period</dt>
              <dd className="text-right text-xs">{payment.leasePeriod}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Method</dt>
              <dd>{payment.method}</dd>
            </div>
            {payment.lineItems && payment.lineItems.length > 0 ? (
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">
                  What this payment covers
                </p>
                <div className="space-y-1.5">
                  {payment.lineItems.map((line) => (
                    <div
                      key={line.label}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span className="text-slate-700">{line.label}</span>
                      <span className="font-medium tabular-nums">
                        ₱{line.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[0.65rem] text-muted-foreground pt-1">
                  Initial move-in total: first month&apos;s rent, one month
                  advance (applied to your first month), and a one-month
                  security deposit held until the lease ends, subject to your
                  agreement with the landlord.
                </p>
              </div>
            ) : null}
            {payment.notes ? (
              <div className="pt-2">
                <p className="text-[0.7rem] font-semibold text-slate-600">
                  Notes / description
                </p>
                <p className="mt-1 text-[0.75rem] text-slate-700 whitespace-pre-wrap">
                  {payment.notes}
                </p>
              </div>
            ) : null}
            {!payment.lineItems && payment.monthlyRent ? (
              <p className="text-[0.7rem] text-muted-foreground pt-1">
                Monthly rent on file: ₱
                {payment.monthlyRent.toLocaleString()}. This payment amount may
                cover a partial period or other charges—see notes if provided.
              </p>
            ) : null}
            <div className="flex justify-between gap-4 pt-4 border-t border-slate-200">
              <dt className="font-semibold">Total amount paid</dt>
              <dd className="font-semibold text-lg">
                ₱{payment.amount.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{payment.status}</dd>
            </div>
          </dl>
          <p className="mt-8 text-[0.65rem] text-muted-foreground text-center">
            This receipt was generated from your DormConnect account. Keep for your records.
          </p>
        </div>
      )}
    </div>
  );
}
