"use client";

import { apiUrl } from "@/lib/api";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  Eye,
  MoreVertical,
  Bell,
  Trash2
} from "lucide-react";
import PatientAvatar from "./PatientAvatar";
import { Patient } from "./PatientProfile";
import BookingModalWrapper from "./BookingModalWrapper";
import { Appointment } from "../hooks/useAppointments";
import { useAuth } from "@/hooks/useAuth";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { getAuthHeaders } from "@/lib/auth-headers";

// dummy data removed per request

// appointment history dummy data removed per request

interface PatientsViewProps {
  doctorFilter?: string; // When set, only show patients this doctor has seen
}

const getPatientStatusTooltip = (status: string, overdueAppointmentCount?: number | null) => {
  switch (status.toLowerCase()) {
    case "overdue": {
      if (typeof overdueAppointmentCount !== "number") return null;
      const count = Math.max(0, overdueAppointmentCount);
      return `You have ${count} overdue appointment${count === 1 ? "" : "s"}.`;
    }
    case "inactive":
      return "It's inactive because you haven't had any appointment for over a year.";
    default:
      return null;
  }
};

const isTourDemoPatient = (patient: Patient) =>
  String(patient.id || "").toUpperCase().includes("ENT_TEST");

const PATIENT_STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "inactive", label: "Inactive" },
];

const activeDropdownItemClass = (isActive: boolean) =>
  isActive ? "bg-violet-600 text-white focus:bg-violet-600 focus:text-white [&_svg]:text-white" : "";

export function PatientsView({ doctorFilter }: PatientsViewProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [paginatedPatients, setPaginatedPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  const [isPatientDeleteDialogOpen, setIsPatientDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messagePatient, setMessagePatient] = useState<Patient | null>(null);
  const [messageContent, setMessageContent] = useState("");

  const itemsPerPage = 10;
  const { user } = useAuth();
  const { effectiveRole } = useAdminViewMode();
  const { openAddPatientModal, refreshPatients, refreshTrigger, newAppointmentCreationMode } = useAppointmentModal();

  // BookingModal state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  // immediate default patient id to pass to the booking modal (set synchronously on click)
  const [bookingDefaultPatientId, setBookingDefaultPatientId] = useState<string | undefined>(undefined);
  const [selectedAppointmentToEdit, setSelectedAppointmentToEdit] = useState<Appointment | null>(null);

  // Clear the synchronous booking default id when modal closes
  useEffect(() => {
    if (!bookingModalOpen) setBookingDefaultPatientId(undefined);
  }, [bookingModalOpen]);
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | undefined>(undefined);
  const [nextAvailableTime, setNextAvailableTime] = useState<string | undefined>(undefined);
  const [nextAvailableDoctor, setNextAvailableDoctor] = useState<string>("");

  const fetchPatients = React.useCallback(async (page = 1) => {
    // Add a timeout so the fetch can't hang indefinitely in the client
    const controller = new AbortController();
    const timeoutMs = 5000; // 5 seconds
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      setIsLoading(true);

      const q = encodeURIComponent(searchTerm || "");
      const statusParam = statusFilter || "all";
      const requestPage = page;
      const requestLimit = itemsPerPage;
      const doctorParam = doctorFilter ? `&doctor=${encodeURIComponent(doctorFilter)}` : "";
      const headers = getAuthHeaders();
      const patientUrl = apiUrl(`/api/patients?page=${requestPage}&limit=${requestLimit}&search=${q}&status=${statusParam}${doctorParam}`);
      const res = await fetch(patientUrl, { signal: controller.signal, headers, credentials: "include" });
      const result = await res.json();

      if (result && result.success) {
        const data = result.data || [];
        const meta = result.meta || { total: 0, page: requestPage, limit: requestLimit, totalPages: 1 };

        const transformedPatients = data.map((patient: Patient) => {
          return {
            ...patient,
            name: patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
            lastVisit: patient.lastVisit || "",
            nextAppointment: patient.nextAppointment ?? null,
            status: patient.status || "active",
            balance: patient.balance ?? 0,
            overdueAppointmentCount: patient.overdueAppointmentCount ?? 0,
          };
        });

        setPaginatedPatients(transformedPatients);
        setTotalPages(meta.totalPages || 1);
        setTotalFiltered(meta.total || transformedPatients.length);
      } else {
        setPaginatedPatients([]);
        setTotalPages(1);
        setTotalFiltered(0);
      }
    } catch (err) {
      console.error("Error fetching patients:", err);
      // If the request was aborted due to timeout, fall back to local mock data so the UI remains usable
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`Patient fetch aborted after ${timeoutMs}ms; returning empty list.`);
        toast.error('Patient fetch timed out.');
        setPaginatedPatients([]);
        setTotalPages(1);
        setTotalFiltered(0);
      } else {
        // Other network or parsing errors - return empty list so UI doesn't hang
        console.warn('Failed to fetch patients; returning empty list.');
        toast.error('Failed to fetch patients from backend.');
        setPaginatedPatients([]);
        setTotalPages(1);
        setTotalFiltered(0);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter, doctorFilter, itemsPerPage]);

  // Reset page when search or status changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Fetch patients when page, search, status filter, or refresh trigger changes
  useEffect(() => {
    fetchPatients(currentPage);
  }, [currentPage, fetchPatients, refreshTrigger]);

  const getStatusBadge = (status: string | undefined, overdueAppointmentCount?: number | null) => {
    const s = status?.toLowerCase() || "active";
    let badge: React.ReactNode;

    switch (s) {
      case "active":
        badge = <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>;
        break;
      case "overdue":
        badge = <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">Overdue</Badge>;
        break;
      case "inactive":
        badge = <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-50">Inactive</Badge>;
        break;
      default:
        badge = <Badge variant="outline" className="capitalize">{s}</Badge>;
    }

    const tooltip = getPatientStatusTooltip(s, overdueAppointmentCount);
    if (!tooltip) return badge;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help" title={tooltip} aria-label={tooltip} tabIndex={0}>
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

  const formatDateOfBirth = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const handleAddPatient = () => {
    openAddPatientModal();
  };

  const openPatientProfile = (patient: Patient) => {
    const displayName = (patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`).trim();
    const routeSegment = encodeURIComponent(displayName || String(patient.id || ""));
    const profileBasePath = pathname.startsWith("/admin") ? "/admin/patients" : "/receptionist/patients";
    router.push(`${profileBasePath}/${routeSegment}`);
  };

  const renderPatientActions = (patient: Patient, triggerClassName = "h-8 w-8 text-slate-400 hover:text-slate-900") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-tour-id={isTourDemoPatient(patient) ? "patients-demo-actions" : undefined}
          className={triggerClassName}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-tour-id={isTourDemoPatient(patient) ? "patients-demo-actions-menu" : undefined}
        className="w-48"
      >
        <DropdownMenuItem
          data-tour-id={isTourDemoPatient(patient) ? "patients-demo-view-details" : undefined}
          className="gap-2"
          onClick={() => {
            openPatientProfile(patient);
          }}
        >
          <Eye className="h-4 w-4 text-slate-400" />
          Patient Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onClick={() => {
            setMessagePatient(patient);
            setIsMessageModalOpen(true);
          }}
        >
          <Bell className="h-4 w-4 text-slate-400" />
          Send Message
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 font-medium text-violet-600 focus:text-violet-700"
          onClick={() => {
            setSelectedPatient(patient);
            setBookingDefaultPatientId(String(patient.id));
            setNextAvailableDate(undefined);
            setNextAvailableTime(undefined);
            if (user?.role === 'doctor') {
              setNextAvailableDoctor(user?.username || "");
            } else {
              setNextAvailableDoctor("");
            }
            setSelectedAppointmentToEdit(null);
            setBookingModalOpen(true);
          }}
        >
          <Calendar className="h-4 w-4" />
          Schedule Visit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-red-600 focus:text-red-700"
          onClick={() => {
            setPatientToDelete(patient);
            setIsPatientDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Remove Patient
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const handleConfirmDeletePatient = async () => {
    if (!patientToDelete?.id) {
      toast.error("Missing patient id");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientToDelete.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Patient deleted successfully");
        setIsPatientDeleteDialogOpen(false);
        setPatientToDelete(null);
        refreshPatients();
        setSelectedPatient(null);
      } else {
        const json = await res.json();
        toast.error(json?.message || "Failed to delete patient");
      }
    } catch (err) {
      console.error("[DELETE PATIENT] Error:", err);
      toast.error("Error deleting patient");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messagePatient || !messageContent.trim()) {
      toast.error("Please enter a message");
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: messagePatient.id,
          patientEmail: messagePatient.alternateEmail || messagePatient.email,
          patientPhone: messagePatient.alternatePhone || messagePatient.phone,
          patientName: messagePatient.name || `${messagePatient.firstName} ${messagePatient.lastName}`,
          message: messageContent
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Message sent to patient via email and SMS");
        setMessageContent("");
        setMessagePatient(null);
        setIsMessageModalOpen(false);
      } else {
        toast.error(result.message || "Failed to send message");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Error sending message");
    }
  };

  return (
    <div
      data-tour-id={doctorFilter ? "doctor-patients-page" : "patients-page"}
      className="mx-auto min-h-screen max-w-[1600px] space-y-5 bg-[#fdfdff] p-3 sm:space-y-8 md:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {doctorFilter ? "My Patients" : "Patient Directory"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-lg">
            {doctorFilter
              ? "Comprehensive list of patients under your care"
              : "Access and manage all patient records and history"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="brand"
            data-tour-id="patients-new-button"
            onClick={handleAddPatient}
            className="w-full shadow-sm sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Patient
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Filters and Search - Unified into one row for better desktop UX */}
        <div className="lg:col-span-12">
          <Card className="border-none shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="relative flex-1 w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 h-11 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-violet-200 transition-all"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl sm:hidden" title="Patient filters">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {PATIENT_STATUS_FILTERS.map((filter) => (
                      <DropdownMenuItem
                        key={filter.value}
                        className={activeDropdownItemClass(statusFilter === filter.value)}
                        onSelect={() => {
                          setStatusFilter(filter.value);
                          setCurrentPage(1);
                        }}
                      >
                        {filter.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setCurrentPage(1);
                      }}
                    >
                      Reset filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="hidden items-center gap-2 sm:flex sm:w-auto">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[160px] h-11 bg-slate-50 border-none focus:ring-1 focus:ring-violet-200">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      {PATIENT_STATUS_FILTERS.map((filter) => (
                        <SelectItem key={filter.value} value={filter.value}>
                          {filter.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-12">
          <Card className="border-none shadow-md ring-1 ring-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-700">
                  Showing {totalFiltered} {totalFiltered === 1 ? 'patient' : 'patients'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-2"></div>
                Loading patients...
              </div>
            </div>
          ) : paginatedPatients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {totalFiltered === 0 && searchTerm
                  ? `No patients match your search "${searchTerm}".`
                  : totalFiltered === 0 && statusFilter !== "all"
                  ? `No ${statusFilter} patients found.`
                  : "No patients yet. Click 'Add New Patient' to get started!"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 sm:hidden">
                {paginatedPatients.map((patient) => (
                  <div key={patient.id} className="rounded-xl border border-slate-100 bg-white shadow-sm">
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <PatientAvatar
                            src={patient.profilePicture}
                            name={patient.name}
                            dob={patient.dateOfBirth || patient.birthDate || patient.dob || patient.birthday}
                            className="h-10 w-10 border border-slate-200 shadow-sm"
                            sizeClass="h-10 w-10"
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-full truncate text-left text-sm font-semibold text-slate-900"
                              onClick={() => openPatientProfile(patient)}
                            >
                              {patient.name}
                            </button>
                            {effectiveRole !== "receptionist" && (
                              <p className="mt-1 truncate text-xs text-slate-500">ID: {patient.id?.slice(-8).toUpperCase()}</p>
                            )}
                          </div>
                        </div>
                        {renderPatientActions(patient, "h-9 w-9 shrink-0 rounded-xl text-slate-500 hover:text-slate-900")}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(patient.status, patient.overdueAppointmentCount)}
                        <Badge variant="outline" className={(patient.balance ?? 0) > 0 ? "border-red-100 bg-red-50 text-red-600" : "border-emerald-100 bg-emerald-50 text-emerald-700"}>
                          ₱{(patient.balance ?? 0).toLocaleString()}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600">
                        <div className="flex min-w-0 items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{patient.phone || "No phone"}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                          <span className="truncate">{patient.nextAppointment || "No appointments"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="w-[300px] text-slate-500 font-medium py-4">Patient Information</TableHead>
                    <TableHead className="text-slate-500 font-medium">Contact Details</TableHead>
                    <TableHead className="text-slate-500 font-medium">Next Visit</TableHead>
                    <TableHead className="text-slate-500 font-medium text-center">Status</TableHead>
                    <TableHead className="text-slate-500 font-medium text-right">Balance</TableHead>
                    <TableHead className="w-[100px] text-slate-500 font-medium text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPatients.map((patient) => (
                    <TableRow
                      key={patient.id}
                      data-tour-id={isTourDemoPatient(patient) ? "patients-demo-row" : undefined}
                      className="group hover:bg-slate-50/50 transition-colors border-slate-100"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <PatientAvatar
                            src={patient.profilePicture}
                            name={patient.name}
                            dob={patient.dateOfBirth || patient.birthDate || patient.dob || patient.birthday}
                            className="h-10 w-10 border border-slate-200 shadow-sm"
                            sizeClass="h-10 w-10"
                          />
                          <div className="min-w-0">
                            <span className="block font-semibold text-slate-900 group-hover:text-violet-600 transition-colors cursor-pointer text-sm truncate"
                              onClick={() => {
                                openPatientProfile(patient);
                              }}
                            >
                              {patient.name}
                            </span>
                            <div className="mt-1 flex flex-col gap-1 text-xs text-slate-500">
                              {effectiveRole !== "receptionist" && (
                                <span className="truncate min-w-0">ID: {patient.id?.slice(-8).toUpperCase()}</span>
                              )}
                              {formatDateOfBirth(patient.dateOfBirth || patient.birthDate || patient.dob || patient.birthday) ? (
                                <span className="truncate min-w-0">{formatDateOfBirth(patient.dateOfBirth || patient.birthDate || patient.dob || patient.birthday)}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <div className="p-1 rounded-md bg-slate-100/50">
                              <Mail className="h-3 w-3 text-slate-400" />
                            </div>
                            <span className="truncate max-w-[180px]">{patient.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <div className="p-1 rounded-md bg-slate-100/50">
                              <Phone className="h-3 w-3 text-slate-400" />
                            </div>
                            <span>{patient.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {patient.nextAppointment ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <Calendar className="h-3.5 w-3.5 text-violet-500" />
                              {patient.nextAppointment}
                            </div>
                            <span className="text-[11px] text-slate-400 ml-5">Scheduled</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Calendar className="h-3.5 w-3.5 opacity-30" />
                            <span>No appointments</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(patient.status, patient.overdueAppointmentCount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-bold text-sm ${ (patient.balance ?? 0) > 0 ? "text-red-500" : "text-emerald-600" }`}>
                            ₱{(patient.balance ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Current</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {renderPatientActions(patient)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

            {/* Pagination */}
              <div className="flex flex-col gap-3 border-t p-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <p className="text-xs text-muted-foreground sm:text-sm">
                Page {currentPage} of {totalPages || 1} | Showing {paginatedPatients.length} of {totalFiltered} patients
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  </div>

      <Dialog open={isPatientDeleteDialogOpen} onOpenChange={setIsPatientDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {patientToDelete ? `Are you sure you want to delete ${patientToDelete.name}? This action cannot be undone.` : "Are you sure you want to delete this patient? This action cannot be undone."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPatientDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeletePatient} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message to Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {messagePatient && (
              <div className="text-sm space-y-2">
                <p><strong>Patient:</strong> {messagePatient.name || `${messagePatient.firstName} ${messagePatient.lastName}`}</p>
                <div className="p-2 bg-gray-50 rounded border text-xs space-y-1">
                  <p className="font-semibold text-gray-500 mb-1 uppercase tracking-wider">Target Contact Info:</p>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className={messagePatient.alternateEmail ? "text-green-600 font-medium" : ""}>
                      {messagePatient.alternateEmail || messagePatient.email}
                      {messagePatient.alternateEmail && " (Personal)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className={messagePatient.alternatePhone ? "text-green-600 font-medium" : ""}>
                      {messagePatient.alternatePhone || messagePatient.phone}
                      {messagePatient.alternatePhone && " (Personal)"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your message here. It will be sent via email and SMS..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent to the patient via email and text message.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsMessageModalOpen(false);
              setMessageContent("");
              setMessagePatient(null);
            }}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleSendMessage} disabled={!messageContent.trim()}>
              <Bell className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {bookingModalOpen && (
        <BookingModalWrapper
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          defaultDate={nextAvailableDate}
          defaultTime={nextAvailableTime}
          doctorName={nextAvailableDoctor}
          defaultPatientId={bookingDefaultPatientId ?? (selectedPatient?.id ? String(selectedPatient.id) : undefined)}
          appointmentToEdit={selectedAppointmentToEdit}
          onBooked={() => {
            setSelectedAppointmentToEdit(null);
            setNextAvailableDate(undefined);
            setNextAvailableTime(undefined);
            setNextAvailableDoctor("");
            setBookingDefaultPatientId(undefined);
            refreshPatients();
          }}
          onDeleted={() => {
            setSelectedAppointmentToEdit(null);
            setNextAvailableDate(undefined);
            setNextAvailableTime(undefined);
            setNextAvailableDoctor("");
            setBookingDefaultPatientId(undefined);
            refreshPatients();
          }}
          appointmentCreationMode={newAppointmentCreationMode}
        />
      )}


    </div>
  );
}
