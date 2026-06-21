import { redirect } from "next/navigation";

export default function PatientIndexPage() {
  redirect("/admin/dashboard");
}
