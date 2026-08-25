"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandlordPaymentsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landlord/reservations?tab=payments");
  }, [router]);
  return null;
}
