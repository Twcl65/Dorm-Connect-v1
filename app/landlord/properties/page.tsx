"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandlordPropertiesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landlord/rooms-management?tab=properties");
  }, [router]);
  return null;
}
