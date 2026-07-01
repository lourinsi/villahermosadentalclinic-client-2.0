"use client";

import { useState, useMemo } from "react";
import { useDoctors } from "@/hooks/useDoctors";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments } from "@/hooks/useAppointments";
import { formatDateToYYYYMMDD } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Calendar, Mail, Award } from "lucide-react";

interface DoctorsGridProps {
  portal: "admin" | "patient" | "public";
  onDoctorSelect?: (doctor: any) => void;
}

export function DoctorsGrid({ portal, onDoctorSelect }: DoctorsGridProps) {
  const router = useRouter();
  const { user } = useAuth();
  const today = new Date();
  const todayStr = formatDateToYYYYMMDD(today);
  const { appointments: todaysAppointments } = useAppointments(undefined, {
    patientId: user?.patientId,
    startDate: todayStr,
    endDate: todayStr,
  }, {
    enabled: portal === "patient" && Boolean(user?.patientId),
  });
  const { doctors, isLoadingDoctors } = useDoctors(undefined, { publicBooking: portal === "public" });
  const [searchTerm, setSearchTerm] = useState("");

  const hasPatientScheduleToday = portal === "patient" && Boolean(user?.patientId) && todaysAppointments.some((apt) => String(apt.status).toLowerCase() !== "cancelled");

  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter(
      (doctor) =>
        doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [doctors, searchTerm]);

  const handleDoctorClick = (doctor: any) => {
    if (onDoctorSelect) {
      onDoctorSelect(doctor);
      return;
    }

    if (portal === "admin") {
      const basePath = user?.role === "receptionist" ? "/receptionist" : "/admin";
      router.push(`${basePath}/doctors/${encodeURIComponent(doctor.name)}`);
    } else if (portal === "patient") {
      router.push(`/patient/doctors/${encodeURIComponent(doctor.name)}`);
    } else {
      router.push(`/doctors/${encodeURIComponent(doctor.name)}`);
    }
  };

  const getButtonText = () => {
    if (portal === "admin") return "Book Appointment";
    return "View Availability";
  };

  const getDescription = () => {
    if (portal === "admin") {
      return "Meet our team of experienced professionals. Select a doctor to book an appointment for a patient.";
    }

    return "Meet our team of experienced professionals dedicated to your oral health.";
  };

  if (isLoadingDoctors) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-tour-id={portal === 'admin' ? 'admin-doctors-page' : portal === 'patient' ? 'patient-doctors-page' : 'public-doctors-page'} className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Our Dental Specialists</h1>
        <p className="text-muted-foreground text-lg">{getDescription()}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or specialization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.length > 0 ? (
          filteredDoctors.map((doctor) => (
            <Card
              key={doctor.id}
              className="overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-4 bg-muted/30">
                <div className="flex items-start justify-between">
                  <Avatar className="h-20 w-20 border-2 border-background shadow-sm">
                    {doctor.profilePicture && (
                      <AvatarImage
                        src={doctor.profilePicture}
                        alt={doctor.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {doctor.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant="secondary" className="font-medium">
                    {doctor.specialization}
                  </Badge>
                </div>
                <div className="mt-4">
                  <CardTitle className="text-xl">{doctor.name}</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium">{doctor.role}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-grow space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Award className="h-4 w-4" />
                    <span>Specialist in {doctor.specialization}</span>
                  </div>
                  {doctor.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{doctor.email}</span>
                    </div>
                  )}
                </div>

                <div className="text-sm line-clamp-3 italic text-muted-foreground">
                  {doctor.bio ||
                    "Dedicated to providing high-quality dental care with a gentle touch and personalized approach for every patient."}
                </div>
              </CardContent>
              <CardFooter className="pt-2 border-t bg-muted/5 flex flex-col gap-2">
                <Button
                  data-tour-id="doctor-card-button"
                  onClick={() => !hasPatientScheduleToday && handleDoctorClick(doctor)}
                  disabled={hasPatientScheduleToday}
                  title={hasPatientScheduleToday ? "You already have a schedule today and cannot book another same-day appointment." : undefined}
                  className={`w-full gap-2 bg-blue-600 hover:bg-blue-700 ${hasPatientScheduleToday ? "opacity-60 cursor-not-allowed hover:bg-blue-600" : ""}`}
                >
                  <Calendar className="h-4 w-4" />
                  {getButtonText()}
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground text-lg">No doctors found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
