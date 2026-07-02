"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { readPatientProfileDraft } from "@/lib/patient-profile-draft";

const normalizePath = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

export function PatientProfileDraftRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    const portalBasePath = pathname.startsWith("/admin")
      ? "/admin"
      : pathname.startsWith("/receptionist")
        ? "/receptionist"
        : null;

    if (!portalBasePath || pathname === `${portalBasePath}/login`) return;

    const draft = readPatientProfileDraft();
    if (!draft?.path.startsWith(`${portalBasePath}/patients/`)) return;
    if (!draft || normalizePath(draft.path) === normalizePath(pathname)) return;

    toast.info("Recovered unsaved patient changes.");
    router.replace(draft.path);
  }, [pathname, router]);

  return null;
}
