"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppointments, Appointment } from "@/hooks/useAppointments";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses } from "@/hooks/usePaymentStatuses";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, Briefcase, CreditCard, CheckCircle2, Search, X, ArrowUpDown } from "lucide-react";
import { getAppointmentTypeName } from "@/lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { parseBackendDateToLocal } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePaymentModal } from "@/hooks/usePaymentModal";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import AppointmentHistoryView from "@/components/AppointmentHistoryView";
import { Input } from "@/components/ui/input";
import { isCartAppointmentStatus } from "@/lib/appointment-status";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
    formatPaymentStatusLabel,
    getAppointmentStatusBadgeClassName,
    getPaymentStatusBadgeClassName,
} from "@/lib/status-colors";

const OrdersContent = () => {
    const searchParams = useSearchParams();
    const appointmentIdParam = searchParams.get("appointmentId");
    
    const { user, isLoading: authLoading } = useAuth();
    const { appointments, isLoading: appointmentsLoading } = useAppointments(undefined, { patientId: user?.patientId });
    const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
    const { statuses: PAYMENT_STATUSES } = usePaymentStatuses();
    const { openEditModal } = useAppointmentModal();
    const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
    const [historySnapshot, setHistorySnapshot] = useState<any | null>(null);
    const [historyLogDate, setHistoryLogDate] = useState<string | undefined>(undefined);
    const [sortedAppointments, setSortedAppointments] = useState<Appointment[]>([]);
    
    // Helper function to get status label
    const getStatusLabel = (statusValue: string): string => {
      const status = APPOINTMENT_STATUSES.find(s => s.value === statusValue);
      return status?.label || statusValue.charAt(0).toUpperCase() + statusValue.slice(1);
    };
    
    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [sortBy, setSortBy] = useState<string>("date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    useEffect(() => {
        if (appointments) {
            const sorted = [...appointments].sort((a, b) => {
                const dateA = parseBackendDateToLocal(a.date).getTime();
                const dateB = parseBackendDateToLocal(b.date).getTime();
                if (dateB !== dateA) {
                    return dateB - dateA; // Sort by date descending
                }
                return a.time.localeCompare(b.time); // Then by time ascending
            });
            setSortedAppointments(sorted);

            // If appointmentId is in URL, open booking modal in edit mode
            if (appointmentIdParam) {
                const apt = sorted.find(a => a.id === appointmentIdParam);
                if (apt && apt.paymentStatus !== 'paid') {
                    openEditModal(apt, true);
                }
            }
        }
    }, [appointments, appointmentIdParam, openEditModal]);

    useEffect(() => {
        const onUpdated = (e: Event) => {
            try {
                const detail = (e as CustomEvent)?.detail || {};
                const { appointmentId, newStatus, newPaymentStatus } = detail;
                if (appointmentId) {
                    // trigger a refresh to ensure canonical state
                    // useAppointments hook is used above, so changing nothing here; rely on its polling/refresh
                    // but we can also optimistically update local state
                    setSortedAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus || a.status, paymentStatus: newPaymentStatus || a.paymentStatus } : a));
                }
            } catch (err) {}
        };
        window.addEventListener('appointments:updated', onUpdated as EventListener);
        return () => window.removeEventListener('appointments:updated', onUpdated as EventListener);
    }, []);

    const handleOpenPayment = (apt: Appointment) => {
        // Open BookingModal in view mode (patient readonly) with payment flow
        console.log('[Orders] Pay Now clicked:', { appointmentId: apt.id, doctor: apt.doctor, date: apt.date, time: apt.time });
        try {
            console.log('[Orders] Calling openEditModal with:', { appointmentId: apt.id, isPatientReadonly: true, isPaymentFlow: true });
            openEditModal(apt, true, true);
            console.log('[Orders] openEditModal called successfully');
        } catch (err) {
            console.error('[Orders] Error calling openEditModal:', err);
        }
    };

    const displayStatus = (s?: string) => {
        if (!s) return "";
        return getStatusLabel(s);
    };

    const resetFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setPaymentStatusFilter("all");
        setDateRange(undefined);
    };

    const filteredAppointments = sortedAppointments.filter(apt => {
        // Search query filter
        const appointmentType = getAppointmentTypeName(apt.type, apt.customType).toLowerCase();
        const doctorName = apt.doctor.toLowerCase();
        const matchesSearch = appointmentType.includes(searchQuery.toLowerCase()) || 
                             doctorName.includes(searchQuery.toLowerCase());

        // Status filter
        const matchesStatus = statusFilter === "all" ? !isCartAppointmentStatus(apt.status) : apt.status === statusFilter;

        // Payment status filter
        const matchesPaymentStatus = paymentStatusFilter === "all" || apt.paymentStatus === paymentStatusFilter;

        // Date range filter
        let matchesDate = true;
        if (dateRange?.from) {
            const aptDate = parseBackendDateToLocal(apt.date);
            // Set time to 0 to compare only dates
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            
            if (aptDate < fromDate) {
                matchesDate = false;
            }

            if (dateRange.to) {
                const toDate = new Date(dateRange.to);
                toDate.setHours(23, 59, 59, 999);
                if (aptDate > toDate) {
                    matchesDate = false;
                }
            }
        }

        return matchesSearch && matchesStatus && matchesPaymentStatus && matchesDate;
    }).sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case "date":
                const dateA = parseBackendDateToLocal(a.date).getTime();
                const dateB = parseBackendDateToLocal(b.date).getTime();
                comparison = dateA - dateB;
                break;
            case "doctor":
                comparison = a.doctor.localeCompare(b.doctor);
                break;
            case "type":
                const typeA = getAppointmentTypeName(a.type, a.customType);
                const typeB = getAppointmentTypeName(b.type, b.customType);
                comparison = typeA.localeCompare(typeB);
                break;
            case "price":
                comparison = (a.price || 0) - (b.price || 0);
                break;
            case "status":
                comparison = (a.status || "").localeCompare(b.status || "");
                break;
            default:
                comparison = 0;
        }

        return sortOrder === "asc" ? comparison : -comparison;
    });

    const isLoading = authLoading || appointmentsLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900">My Bookings</h1>
                    <p className="text-muted-foreground mt-1">View and manage all your appointments</p>
                </div>
                {(searchQuery || statusFilter !== "all" || paymentStatusFilter !== "all" || dateRange) && (
                    <Button variant="outline" size="sm" onClick={resetFilters} className="text-muted-foreground border-gray-300">
                        <X className="h-4 w-4 mr-2" />
                        Clear Filters
                    </Button>
                )}
            </div>

            {/* Filters Section */}
            <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-50 pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold text-gray-800">Filters</CardTitle>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-gray-200 gap-2 text-gray-700 hover:bg-violet-50"
                                    title="Sort appointments"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                    <span className="text-xs font-medium">Sort</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="end">
                                <div className="p-4 space-y-4">
                                    {/* Sort By Section */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold text-gray-900">Sort By</p>
                                        <div className="space-y-1.5">
                                            {[
                                                { value: "date", label: "Date" },
                                                { value: "doctor", label: "Doctor" },
                                                { value: "type", label: "Appointment Type" },
                                                { value: "price", label: "Price" },
                                                { value: "status", label: "Status" }
                                            ].map(option => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        setSortBy(option.value);
                                                        setSortOrder("desc");
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                                        sortBy === option.value
                                                            ? "bg-violet-100 text-violet-700"
                                                            : "hover:bg-gray-100 text-gray-700"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-2">
                                                            <span className="w-4 h-4 rounded border border-gray-300 flex items-center justify-center">
                                                                {sortBy === option.value && (
                                                                    <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                                                                )}
                                                            </span>
                                                            {option.label}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-px bg-gray-200"></div>

                                    {/* Sort Order Section */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold text-gray-900">Order</p>
                                        <div className="space-y-1.5">
                                            {[
                                                { value: "desc", label: "Descending" },
                                                { value: "asc", label: "Ascending" }
                                            ].map(option => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => setSortOrder(option.value as "asc" | "desc")}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                                        sortOrder === option.value
                                                            ? "bg-violet-100 text-violet-700"
                                                            : "hover:bg-gray-100 text-gray-700"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-2">
                                                            <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center">
                                                                {sortOrder === option.value && (
                                                                    <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                                                                )}
                                                            </span>
                                                            {option.label}
                                                        </span>
                                                        {option.value === "asc" && <span className="text-lg">↑</span>}
                                                        {option.value === "desc" && <span className="text-lg">↓</span>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search type or doctor..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 border-gray-200"
                            />
                        </div>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="border-gray-200">
                                <SelectValue placeholder="Appointment Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {APPOINTMENT_STATUSES.filter((status) => !isCartAppointmentStatus(status.value)).map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                            <SelectTrigger className="border-gray-200">
                                <SelectValue placeholder="Payment Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payment Status</SelectItem>
                                {PAYMENT_STATUSES.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal border-gray-200",
                                        !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                                            </>
                                        ) : (
                                            dateRange.from.toLocaleDateString()
                                        )
                                    ) : (
                                        <span>Filter by date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <CalendarComponent
                                    autoFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={1}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardContent>
            </Card>

            {filteredAppointments.length === 0 ? (
                <div className="text-center py-12 border rounded-2xl bg-gray-50">
                    <div className="p-4 bg-white rounded-full shadow-sm w-fit mx-auto mb-4">
                        <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-900 font-semibold text-lg">
                        {sortedAppointments.length === 0 
                            ? "You have no booked appointments" 
                            : "No appointments match your filters"}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                        {sortedAppointments.length === 0 
                            ? "Schedule your first visit with us today!" 
                            : "Try adjusting your filters"}
                    </p>
                    {sortedAppointments.length > 0 && (
                        <Button variant="link" onClick={resetFilters} className="mt-4 text-violet-600 hover:text-violet-700">
                            Clear all filters
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAppointments.map(appointment => (
                        <Card 
                            key={appointment.id} 
                            className={`border-none shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${appointmentIdParam === appointment.id ? "ring-2 ring-violet-500" : ""}`}
                        >
                            <CardHeader className="border-b border-gray-50 pb-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-xl font-bold text-gray-900">{getAppointmentTypeName(appointment.type, appointment.customType)}</CardTitle>
                                        <p className="text-sm text-gray-500 mt-1">with Dr. {appointment.doctor}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge 
                                            variant="secondary"
                                            className={`font-medium ${getAppointmentStatusBadgeClassName(appointment.status, APPOINTMENT_STATUSES)}`}
                                        >
                                            {displayStatus(appointment.status)}
                                        </Badge>
                                        {appointment.paymentStatus && (
                                            <Badge 
                                                className={`font-medium ${getPaymentStatusBadgeClassName(appointment.paymentStatus, PAYMENT_STATUSES)}`}
                                            >
                                                {formatPaymentStatusLabel(appointment.paymentStatus).toUpperCase()}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-violet-50">
                                            <Calendar className="w-4 h-4 text-violet-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Date</div>
                                            <div className="text-sm font-medium text-gray-900">{parseBackendDateToLocal(appointment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-50">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Time</div>
                                            <div className="text-sm font-medium text-gray-900">{formatTimeTo12h(appointment.time)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-amber-50">
                                            <Briefcase className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Duration</div>
                                            <div className="text-sm font-medium text-gray-900">{appointment.duration || 30} minutes</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-green-50">
                                            <CreditCard className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Price</div>
                                            <div className="text-sm font-semibold text-gray-900">₱{appointment.price || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-gray-50 border-t border-gray-100 p-4">
                                <div className="w-full flex justify-end">
                                    {appointment.paymentStatus !== 'paid' && appointment.status !== 'cancelled' ? (
                                        <Button 
                                            onClick={() => handleOpenPayment(appointment)} 
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
                                        >
                                            <CreditCard className="h-4 w-4" />
                                            Pay Now
                                        </Button>
                                    ) : appointment.paymentStatus === 'paid' ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center text-emerald-600 text-sm font-medium gap-2">
                                                <CheckCircle2 className="h-5 w-5" />
                                                Payment Complete
                                            </div>
                                            <Button 
                                                onClick={() => {
                                                    setHistorySnapshot(appointment);
                                                    setHistoryLogDate(undefined);
                                                    setIsHistoryOpen(true);
                                                }}
                                                variant="outline"
                                                size="sm"
                                                className="border-gray-300 text-gray-700 hover:bg-gray-100"
                                            >
                                                View
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-red-600 text-sm font-medium gap-2">
                                            <CheckCircle2 className="h-5 w-5" />
                                            Appointment Cancelled
                                        </div>
                                    )}
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <AppointmentHistoryView
                open={isHistoryOpen}
                onOpenChange={(open) => setIsHistoryOpen(open)}
                appointmentSnapshot={historySnapshot}
                logDate={historyLogDate || ""}
            />
        </div>
    );
};

const OrdersPage = () => {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        }>
            <OrdersContent />
        </Suspense>
    );
};

export default OrdersPage;
