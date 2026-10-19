"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PaymentReceiptCard } from "@/components/payments/payment-receipt-card";
import type { PaymentReceiptData } from "@/lib/payment-receipt-data";

export default function PaymentReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [payment, setPayment] = useState<PaymentReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/student/payments/${id}`, {
        credentials: "include",
      });
      const j = (await res.json()) as { payment?: PaymentReceiptData; error?: string };
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

      {error && <p className="text-sm text-red-700">{error}</p>}

      {payment && <PaymentReceiptCard payment={payment} />}
    </div>
  );
}
