import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  void children;
  redirect("/admin/dashboard");
}
