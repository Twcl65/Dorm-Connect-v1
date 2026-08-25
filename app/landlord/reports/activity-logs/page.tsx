"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandlordActivityLogsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landlord/incidents?tab=activity-logs");
  }, [router]);
  return null;
}
