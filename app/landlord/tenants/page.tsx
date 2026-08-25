"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandlordTenantsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landlord/rooms-management?tab=tenants");
  }, [router]);
  return null;
}
