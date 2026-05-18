import { redirect } from "next/navigation";

/** Legacy route — inspections replaced Safety & Compliance. */
export default function OsaSafetyRedirectPage() {
  redirect("/osa/inspections");
}
