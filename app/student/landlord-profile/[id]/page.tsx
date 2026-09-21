"use client";

import { LandlordProfileDialog } from "@/components/student/landlord-profile-dialog";
import { useParams, useRouter } from "next/navigation";

export default function StudentLandlordProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  return (
    <LandlordProfileDialog
      propertyId={params.id}
      onClose={() => router.push("/student/browse")}
    />
  );
}
