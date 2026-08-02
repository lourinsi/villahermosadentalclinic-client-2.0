"use client";

import React from "react";
import TreatmentHistoryView from "./TreatmentHistoryView";

interface HistoryViewProps {
  doctorFilter?: string;
}

export function HistoryView({ doctorFilter }: HistoryViewProps = {}) {
  return (
    <TreatmentHistoryView
      showPatientColumn={true}
      showStatsCards={true}
      doctorFilter={doctorFilter}
      title="Treatment History"
      subtitle="Completed appointments and history records"
    />
  );
}

export default HistoryView;
