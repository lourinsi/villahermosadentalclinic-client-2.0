import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default function PatientLayout({ children }: { children: ReactNode }) {
  void children;
  redirect("/admin/dashboard");
}
