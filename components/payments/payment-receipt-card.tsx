"use client";

import type { PaymentReceiptData } from "@/lib/payment-receipt-data";

type Props = {
  payment: PaymentReceiptData;
  footerNote?: string;
  className?: string;
};

export function PaymentReceiptCard({
  payment,
  footerNote = "This receipt was generated from your DormConnect account. Keep for your records.",
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:shadow-none print:border-0 ${className}`}
    >
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
        {payment.periodLabel ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Period</dt>
            <dd className="text-right">{payment.periodLabel}</dd>
          </div>
        ) : null}
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
              Initial move-in total: first month&apos;s rent, one month advance
              (applied to your first month), and a one-month security deposit held
              until the lease ends, subject to your agreement with the landlord.
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
            {payment.monthlyRent.toLocaleString()}. This payment amount may cover
            a partial period or other charges—see notes if provided.
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
      {payment.proofImageUrl && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600 mb-2">
            GCash Receipt / Proof of Payment
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.proofImageUrl}
            alt="GCash receipt submitted by student"
            className="max-h-72 w-auto max-w-full rounded-md border border-slate-200 object-contain shadow-sm"
          />
        </div>
      )}
      <p className="mt-8 text-[0.65rem] text-muted-foreground text-center">
        {footerNote}
      </p>
    </div>
  );
}
