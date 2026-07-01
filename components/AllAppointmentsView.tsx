import React, { useState, useMemo } from "react";
import { Appointment } from "../hooks/useAppointments";
import { useAppointmentStatuses } from "@/hooks/useAppointmentStatuses";
import { usePaymentStatuses } from "@/hooks/usePaymentStatuses";
import {
  formatAppointmentStatusLabel,
  isCartAppointmentStatus,
} from "@/lib/appointment-status";
import {
  formatPaymentStatusLabel,
  getAppointmentStatusBadgeClassName,
  getAppointmentStatusOptionWithColors,
  getPaymentStatusBadgeClassName,
  getStatusDotColorClass,
} from "@/lib/status-colors";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { 
  ArrowUp, 
  ArrowDown, 
  Search, 
  LayoutGrid, 
  List, 
  Calendar as CalendarIcon, 
  User, 
  Stethoscope, 
  CreditCard,
  Hash
} from "lucide-react";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

type SortKey = "date" | "patientName" | "doctor" | "status" | "price";
type ViewType = "table" | "grid";

interface AllAppointmentsViewProps {
  appointments: Appointment[];
  isLoading: boolean;
  onPay?: (appointment: Appointment) => void;
  onDelete?: (id: string) => void;
  onOpenAppointment?: (appointment: Appointment) => void;
  isCart?: boolean;
}

export const AllAppointmentsView: React.FC<AllAppointmentsViewProps> = ({ 
  appointments, 
  isLoading, 
  onPay, 
  onDelete,
  onOpenAppointment,
  isCart 
}) => {
  const { statuses: APPOINTMENT_STATUSES } = useAppointmentStatuses();
  const { statuses: PAYMENT_STATUSES } = usePaymentStatuses();

  const displayStatus = (s?: string) => {
    if (!s) return "";
    return formatAppointmentStatusLabel(s);
  };

  const displayPaymentStatus = (p?: string) => {
    return formatPaymentStatusLabel(p);
  };
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewType, setViewType] = useState<ViewType>(isCart ? "grid" : "table");

  const filteredAndSortedAppointments = useMemo(() => {
    if (!appointments) return [];

    let filtered = [...appointments];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.patientName.toLowerCase().includes(q) ||
        a.doctor.toLowerCase().includes(q) ||
        getAppointmentTypeName(a.type, a.customType).toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => {
      let compareA: string | number;
      let compareB: string | number;

      switch (sortKey) {
        case "date":
          compareA = new Date(`${a.date}T${a.time}`).getTime();
          compareB = new Date(`${b.date}T${b.time}`).getTime();
          break;
        case "patientName":
          compareA = a.patientName.toLowerCase();
          compareB = b.patientName.toLowerCase();
          break;
        case "doctor":
          compareA = a.doctor.toLowerCase();
          compareB = b.doctor.toLowerCase();
          break;
        case "status":
          compareA = a.status?.toLowerCase() || "";
          compareB = b.status?.toLowerCase() || "";
          break;
        case "price":
          compareA = a.price || 0;
          compareB = b.price || 0;
          break;
        default:
          compareA = new Date(`${a.date}T${a.time}`).getTime();
          compareB = new Date(`${b.date}T${b.time}`).getTime();
      }

      if (compareA < compareB) {
        return sortOrder === "asc" ? -1 : 1;
      }
      if (compareA > compareB) {
        return sortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [appointments, sortOrder, sortKey, searchTerm]);

  const toggleSortOrder = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey === key) {
      return sortOrder === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
    }
    return null;
  };

  const getStatusBadgeClass = (status: string = "") => {
    return getAppointmentStatusBadgeClassName(status, APPOINTMENT_STATUSES);
  };

  const getPaymentBadgeClass = (status: string = "") => {
    return getPaymentStatusBadgeClassName(status, PAYMENT_STATUSES);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
        <p className="text-gray-500 font-medium">Loading appointments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search appointments..." 
            className="pl-9 h-10 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <Button 
            variant={viewType === "table" ? "outline" : "ghost"} 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setViewType("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button 
            variant={viewType === "grid" ? "outline" : "ghost"} 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setViewType("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredAndSortedAppointments.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500 font-medium">
            {searchTerm ? `No appointments matching "${searchTerm}"` : 
             (isCart ? "Your cart is empty." : "No appointments found.")}
          </p>
          {!searchTerm && isCart && (
            <p className="text-sm text-gray-400 mt-1">Book an appointment to get started!</p>
          )}
        </div>
      ) : viewType === "table" ? (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <Button variant="ghost" onClick={() => toggleSortOrder("patientName")} className="hover:bg-transparent p-0 h-auto text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Patient {getSortIcon("patientName")}
                  </Button>
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <Button variant="ghost" onClick={() => toggleSortOrder("date")} className="hover:bg-transparent p-0 h-auto text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Date & Time {getSortIcon("date")}
                  </Button>
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <Button variant="ghost" onClick={() => toggleSortOrder("doctor")} className="hover:bg-transparent p-0 h-auto text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Doctor {getSortIcon("doctor")}
                  </Button>
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <Button variant="ghost" onClick={() => toggleSortOrder("status")} className="hover:bg-transparent p-0 h-auto text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Status {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Payment</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">
                   <Button variant="ghost" onClick={() => toggleSortOrder("price")} className="hover:bg-transparent p-0 h-auto text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Price {getSortIcon("price")}
                  </Button>
                </TableHead>
                {(onPay || onDelete) && (
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right min-w-[150px]">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedAppointments.map((appointment) => (
                <TableRow
                  key={appointment.id}
                  className={`hover:bg-gray-50/50 transition-colors ${onOpenAppointment ? "cursor-pointer" : ""}`}
                  onClick={() => onOpenAppointment?.(appointment)}
                >
                  <TableCell className="font-semibold text-gray-900">{appointment.patientName}</TableCell>
                  <TableCell className="text-gray-600 font-medium">
                    {appointment.date} @ {formatTimeTo12h(appointment.time)}
                  </TableCell>
                  <TableCell>{getAppointmentTypeName(appointment.type, appointment.customType)}</TableCell>
                  <TableCell className="text-gray-600">Dr. {appointment.doctor}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${getStatusBadgeClass(appointment.status)}`}>
                      {displayStatus(appointment.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${getPaymentBadgeClass(appointment.paymentStatus)}`}>
                        {displayPaymentStatus(appointment.paymentStatus)}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900">₱{appointment.price || 0}</TableCell>
                  {(onPay || onDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onPay && appointment.paymentStatus !== "paid" && appointment.status !== "cancelled" && appointment.status !== "deleted" && (
                          <Button 
                            size="sm" 
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold uppercase px-4 shadow-sm active:scale-95 transition-all"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPay(appointment);
                            }}
                          >
                            Pay Now
                          </Button>
                        )}
                        {onDelete && isCartAppointmentStatus(appointment.status) && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 text-[12px] font-semibold uppercase px-4 shadow-sm active:scale-95 transition-all"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(appointment.id || "");
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedAppointments.map((appointment) => {
            const statusAccentClass = getStatusDotColorClass(
              getAppointmentStatusOptionWithColors(appointment.status, APPOINTMENT_STATUSES).bgColor
            );

            return (
            <Card
              key={appointment.id}
              className={`hover:shadow-md transition-all border-gray-200 group relative overflow-hidden ${onOpenAppointment ? "cursor-pointer" : ""}`}
              onClick={() => onOpenAppointment?.(appointment)}
            >
               <div className={`absolute top-0 left-0 w-1 h-full ${statusAccentClass}`} />
              
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {appointment.id?.split('_')[1] || appointment.id}
                    </p>
                    <h3 className="font-bold text-gray-900 group-hover:text-brand transition-colors">
                      {getAppointmentTypeName(appointment.type, appointment.customType)}
                    </h3>
                  </div>
                  <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-black uppercase ${getStatusBadgeClass(appointment.status)}`}>
                    {displayStatus(appointment.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                    <span>{appointment.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 justify-end">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <Badge variant="outline" className={`px-1.5 py-0 text-[10px] font-bold ${getPaymentBadgeClass(appointment.paymentStatus)}`}>
                      {displayPaymentStatus(appointment.paymentStatus).toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{appointment.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 justify-end">
                    <Stethoscope className="h-4 w-4 text-gray-400" />
                    <span className="truncate">Dr. {appointment.doctor}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Amount</p>
                    <p className="font-black text-lg text-gray-900">₱{appointment.price || 0}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    {onPay && appointment.paymentStatus !== "paid" && appointment.status !== "cancelled" && (
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold uppercase px-4 rounded-lg shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPay(appointment);
                        }}
                      >
                        Pay
                      </Button>
                    )}
                    {onDelete && isCartAppointmentStatus(appointment.status) && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 text-[12px] font-semibold uppercase px-3"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(appointment.id || "");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AllAppointmentsView;
