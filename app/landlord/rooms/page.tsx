"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandlordRoomsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/landlord/rooms-management");
  }, [router]);
  return null;
}
