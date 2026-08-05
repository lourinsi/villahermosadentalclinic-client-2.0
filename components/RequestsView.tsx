"use client";

import React from "react";
import TreatmentHistoryView from "./TreatmentHistoryView";

interface RequestsViewProps {
  doctorFilter?: string;
}

export function RequestsView({ doctorFilter }: RequestsViewProps = {}) {
  return (
    <TreatmentHistoryView
      showPatientColumn={true}
      showStatsCards={true}
      statsCardMode="requests"
      doctorFilter={doctorFilter}
      allowedStatuses={["tbd", "reserved"]}
      showApproveReject={true}
      title="Appointment Management"
      subtitle="Review and manage requests"
    />
  );
}

export default RequestsView;
