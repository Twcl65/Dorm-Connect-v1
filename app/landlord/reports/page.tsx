"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandlordManageDormReportsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landlord/incidents?tab=dorm-reports");
  }, [router]);
  return null;
}
