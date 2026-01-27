"use client";

import { usePatientAlerts } from "@/hooks/usePatientAlerts";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize real-time alert listener globally for all doctor pages
  usePatientAlerts();

  return <>{children}</>;
}
