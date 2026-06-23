export type PaymentReceiptLineItem = { label: string; amount: number };

export type PaymentReceiptData = {
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
  lineItems: PaymentReceiptLineItem[] | null;
  notes: string | null;
  periodLabel?: string | null;
};

export function buildInitialPaymentLineItems(
  amountNum: number,
  monthlyRent: number
): PaymentReceiptLineItem[] | null {
  if (monthlyRent <= 0) return null;
  const expectedInitial = monthlyRent * 3;
  if (Math.abs(amountNum - expectedInitial) >= 0.005) return null;
  return [
    { label: "First month rent", amount: monthlyRent },
    { label: "Advance payment (1 month)", amount: monthlyRent },
    {
      label: "Security deposit (refundable at end of lease)",
      amount: monthlyRent,
    },
  ];
}
