"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Clock, Calendar } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PatientAvatar from "./PatientAvatar";
import { useDoctors } from "@/hooks/useDoctors";
import { Appointment } from "@/hooks/useAppointments";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { parseBackendDateToLocal } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";
import { findDoctorForValue, formatDoctorDisplayName } from "@/lib/doctor-identity";
import { getAppointmentPatientDisplayName } from "@/lib/patient-identity";

interface NextAppointmentCardProps {
  appointment: Appointment | null;
  role: "doctor" | "admin" | "patient";
  sameTimeAppointments?: Appointment[];
  onViewDetails: (appointment: Appointment) => void;
  onViewAll?: () => void;
  showHeader?: boolean;
}

export function NextAppointmentCard({
  appointment,
  role,
  sameTimeAppointments = [],
  onViewDetails,
  onViewAll,
  showHeader = false,
}: NextAppointmentCardProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [patientRecord, setPatientRecord] = useState<any | null>(null);
  
  // Ensure hooks order remains consistent across renders by calling useDoctors unconditionally.
  const { doctors } = useDoctors(undefined, { enabled: role === "patient" });
  const displayAppointments = appointment ? [appointment, ...sameTimeAppointments] : [];
  const displayedPatientId = String(displayAppointments[currentIndex]?.patientId || appointment?.patientId || "").trim();
  const displayedAppointmentId = displayAppointments[currentIndex]?.id || appointment?.id || "";
  const doctorsRoute =
    role === "patient" ? "/patient/doctors" :
    role === "admin" ? "/admin/doctors" :
    "/doctors";

  // Rotate through same-time appointments every 5 seconds
  useEffect(() => {
    if (displayAppointments.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayAppointments.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [displayAppointments.length]);

  // Fetch patient record to get latest profile/name data.
  useEffect(() => {
    setPatientRecord(null);

    if (!displayedPatientId) return;

    const patientId = displayedPatientId;
    if (!patientId || patientId === "Occupied" || patientId === "No patient assigned") {
      return;
    }

    const fetchPatientRecord = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("authToken") : ""}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPatientRecord(data.data || null);
        }
      } catch (error) {
        // Silently fail - use appointment data as fallback
        console.debug("Failed to fetch patient record:", error);
      }
    };

    fetchPatientRecord();
  }, [displayedPatientId, displayedAppointmentId]);

  // If no appointment, show empty state
  if (!appointment) {
    const emptyContent = (
      <div className="relative p-12 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 text-gray-600 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="p-4 bg-gray-100 rounded-full">
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">No appointments yet</h3>
            <p className="text-sm text-gray-600">Schedule your first visit with us today!</p>
          </div>
          <Button 
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6"
            onClick={() => router.push(doctorsRoute)}
          >
            Book Now
          </Button>
        </div>
      </div>
    );

    if (showHeader) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-gray-400 font-black uppercase tracking-widest text-sm">Next Appointment</h2>
              <p className="text-gray-300 font-bold text-xs">Don&apos;t miss your upcoming visit</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-600 hover:text-gray-900"
              onClick={onViewAll}
            >
              View All
            </Button>
          </div>
          {emptyContent}
        </div>
      );
    }

    return emptyContent;
  }

  const currentAppointment = displayAppointments[currentIndex] || displayAppointments[0];
  const hasMultiple = displayAppointments.length > 1;
  const currentPatientName = getAppointmentPatientDisplayName(currentAppointment, patientRecord);
  const currentDoctorRecord = findDoctorForValue(
    doctors,
    (currentAppointment as any)?.doctorId ||
      (currentAppointment as any)?.doctorName ||
      currentAppointment.doctor
  );
  const currentDoctorName = String(currentDoctorRecord?.name || currentAppointment.doctor || "").trim();
  const currentDoctorLabel = formatDoctorDisplayName(currentDoctorName);

  const resolveImageSource = (source?: string) => {
    if (!source) return undefined;
    if (source.startsWith("http") || source.startsWith("data:") || source.startsWith("blob:")) return source;
    return apiUrl(source);
  };

  const pickImageSource = (...sources: unknown[]) => {
    for (const source of sources) {
      if (typeof source !== "string") continue;
      const trimmed = source.trim();
      if (trimmed) return trimmed;
    }

    return undefined;
  };

  // Only compute patient image candidate when viewing as doctor/admin
  const patientImageCandidate = (role === "doctor" || role === "admin")
    ? pickImageSource(
        (currentAppointment as any)?.patientProfile,
        (currentAppointment as any)?.patientProfilePicture,
        (currentAppointment as any)?.patientPhoto,
        (currentAppointment as any)?.patientImage,
        (currentAppointment as any)?.patientAvatar,
        (currentAppointment as any)?.profilePicture,
        (currentAppointment as any)?.patient?.profilePicture,
        (currentAppointment as any)?.patient?.profilePictureUrl,
        (currentAppointment as any)?.patient?.photo,
        (currentAppointment as any)?.patient?.avatar,
        // Fallback to fetched patient record
        patientRecord?.profilePicture,
        patientRecord?.profilePictureUrl,
        patientRecord?.photo,
        patientRecord?.avatar
      )
    : undefined;

  const resolvedPatientImage = resolveImageSource(patientImageCandidate as string | undefined);

  // Only compute doctor image candidate for patient role (we reveal doctor's photo to patients)
  const doctorImageCandidate = role === "patient"
    ? pickImageSource(
        (currentAppointment as any)?.doctorProfile,
        (currentAppointment as any)?.doctorProfilePicture,
        (currentAppointment as any)?.doctorPhoto,
        (currentAppointment as any)?.doctorImage,
        (currentAppointment as any)?.doctor?.profilePicture,
        (currentAppointment as any)?.doctor?.profilePictureUrl,
        currentDoctorRecord?.profilePicture,
        (currentDoctorRecord as any)?.profilePictureUrl
      )
    : undefined;

  const resolvedDoctorImage = resolveImageSource(doctorImageCandidate as string | undefined);

  const getInitials = (name?: string) => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  };

  // Doctor/Admin view - show patient details
  if (role === "doctor" || role === "admin") {
    const cardContent = (
      <div className="relative rounded-3xl bg-white border border-emerald-100 shadow-sm overflow-hidden min-h-[240px] flex flex-col group transition-all duration-300 hover:shadow-md w-full">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />
        
        <div className="relative z-10 flex flex-col h-full p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                <Clock className="h-3 w-3" />
                <span>Next Appointment</span>
              </div>
              <h3 className="text-3xl font-black text-gray-900 tracking-tight mt-2">
                {currentPatientName}
              </h3>
              <p className="text-gray-500 font-bold text-lg">
                {getAppointmentTypeName(currentAppointment.type, currentAppointment.customType)}
              </p>
            </div>
            
            <PatientAvatar
              src={resolvedPatientImage}
              name={currentPatientName}
              dob={patientRecord?.dateOfBirth || patientRecord?.birthDate || patientRecord?.dob || patientRecord?.birthday}
              className="h-20 w-20 rounded-2xl bg-emerald-50 flex items-center justify-center border-2 border-emerald-100/50 shadow-inner group-hover:rotate-3 transition-transform duration-500 overflow-hidden"
              sizeClass="h-20 w-20 rounded-2xl"
            />
          </div>

          <div className="mt-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-sm text-gray-700">
                  {parseBackendDateToLocal(currentAppointment.date).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )}
                </span>
              </div>
              <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-sm text-gray-700">{formatTimeTo12h(currentAppointment.time)}</span>
              </div>
            </div>

            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-8 h-12 shadow-lg hover:shadow-emerald-900/10 active:scale-95 transition-all w-full md:w-auto"
              onClick={() => onViewDetails(currentAppointment)}
            >
              View Details
            </Button>
          </div>
        </div>

        {/* Carousel indicators if multiple */}
        {hasMultiple && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5">
            {displayAppointments.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-emerald-500' : 'w-1 bg-emerald-100'}`}
              />
            ))}
          </div>
        )}
      </div>
    );

    if (showHeader) {
      return (
        <div className="space-y-4 w-full h-full flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-gray-400 font-black uppercase tracking-widest text-sm">Next Appointment</h2>
              <p className="text-gray-300 font-bold text-xs">Don&apos;t miss your upcoming visit</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-lg text-emerald-600 font-bold hover:bg-emerald-50"
              onClick={onViewAll}
            >
              View All
            </Button>
          </div>
          <div className="flex-1">
            {cardContent}
          </div>
        </div>
      );
    }

    return cardContent;
  }

  // Patient view - show doctor details
  const patientCardContent = (
    <div className="relative rounded-3xl bg-white border border-violet-100 shadow-sm overflow-hidden min-h-[240px] flex flex-col group transition-all duration-300 hover:shadow-md w-full">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />
      
      <div className="relative z-10 flex flex-col h-full p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-violet-600 bg-violet-50 w-fit px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
              <Calendar className="h-3 w-3" />
              <span>Upcoming Visit</span>
            </div>
            <h3 className="text-3xl font-black text-gray-900 tracking-tight mt-2">
              {getAppointmentTypeName(currentAppointment.type, currentAppointment.customType)}
            </h3>
            <p className="text-gray-500 font-bold text-lg">with {currentDoctorLabel || "Doctor"}</p>
          </div>
          
          <Avatar className="h-20 w-20 rounded-2xl bg-violet-50 flex items-center justify-center border-2 border-violet-100/50 shadow-inner group-hover:-rotate-3 transition-transform duration-500 overflow-hidden">
            {resolvedDoctorImage ? (
              <AvatarImage src={resolvedDoctorImage} alt={currentDoctorName || "Doctor"} className="object-cover" />
            ) : (
              <AvatarFallback className="bg-violet-50 text-center">
                <Calendar className="h-10 w-10 text-violet-400 opacity-60" />
              </AvatarFallback>
            )}
          </Avatar>
        </div>

        <div className="mt-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
              <Calendar className="h-4 w-4 text-violet-600" />
              <span className="font-bold text-sm text-gray-700">
                {parseBackendDateToLocal(currentAppointment.date).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )}
              </span>
            </div>
            <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
              <Clock className="h-4 w-4 text-violet-600" />
              <span className="font-bold text-sm text-gray-700">{formatTimeTo12h(currentAppointment.time)}</span>
            </div>
          </div>

          <Button
            size="lg"
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl px-8 h-12 shadow-lg hover:shadow-violet-900/10 active:scale-95 transition-all w-full md:w-auto"
            onClick={() => onViewDetails(currentAppointment)}
          >
            View Details
          </Button>
        </div>
      </div>

      {/* Carousel indicators if multiple */}
      {hasMultiple && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5">
          {displayAppointments.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-violet-500' : 'w-1 bg-violet-100'}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (showHeader) {
    return (
      <div className="space-y-4 w-full h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-400 font-black uppercase tracking-widest text-sm">Next Appointment</h2>
            <p className="text-gray-300 font-bold text-xs">Don&apos;t miss your upcoming visit</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-lg text-violet-600 font-bold hover:bg-violet-50"
            onClick={onViewAll}
          >
            View All
          </Button>
        </div>
        <div className="flex-1">
          {patientCardContent}
        </div>
      </div>
    );
  }

  return patientCardContent;
}
