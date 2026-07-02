"use client";

import React from "react";
import { 
  Bell, 
  Calendar, 
  CreditCard, 
  MessageSquare, 
  Info, 
  Trash2,
  Check,
  X,
  MoreHorizontal,
  CheckCircle,
  Edit2,
  Ban,
  Eye,
  RotateCcw
} from "lucide-react";
import { Notification, NotificationType } from "../lib/notification-types";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import PatientAvatar from "./PatientAvatar";
// Avoid fetching global doctors list per-notification — prefer images embedded
// in the notification metadata (notificationImage) or doctorProfile. See
// server-side change suggestions below.
import { formatPaymentStatusLabel } from "@/lib/status-colors";
import { formatWordyDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDeleteWithResult?: (id: string) => Promise<boolean>;
  onRestore?: (id: string) => void;
  onUpdateAppointmentStatus?: (appointmentId: string, status: string, notificationId: string) => void;
  onEditAppointment?: (appointmentId: string) => void;
  onViewAppointmentSnapshot?: (appointmentId: string, notification: Notification) => void | Promise<void>;
  onReschedule?: (appointmentId: string) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  portal: 'admin' | 'doctor' | 'patient';
  variant?: 'full' | 'compact';
}

type NotificationChangeSummaryItem = {
  field: string;
  label: string;
  from?: string;
  to?: string;
};

const ignoredChangeFields = new Set(["changedAt", "updatedAt"]);

const isPaymentStatusField = (field: string) =>
  field.replace(/[\s_-]+/g, "").toLowerCase() === "paymentstatus";

const labelForChangeField = (field: string) => {
  const labels: Record<string, string> = {
    paymentStatus: "Payment",
    customType: "Treatment",
  };

  if (labels[field]) return labels[field];

  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
};

const getNotificationChangeSummary = (notification: Notification): NotificationChangeSummaryItem[] => {
  const metadata: any = notification.metadata || {};

  if (Array.isArray(metadata.changeSummary)) {
    return metadata.changeSummary
      .filter((change: any) => change && (change.from || change.to))
      .map((change: any) => ({
        field: String(change.field || change.label || "change"),
        label: String(change.label || labelForChangeField(String(change.field || "change"))),
        from: change.from !== undefined && change.from !== null ? String(change.from) : undefined,
        to: change.to !== undefined && change.to !== null ? String(change.to) : undefined,
      }));
  }

  const changedFields = metadata.changedFields;
  if (!changedFields || typeof changedFields !== "object") return [];

  return Object.entries(changedFields).flatMap<NotificationChangeSummaryItem>(([field, value]: [string, any]) => {
    if (ignoredChangeFields.has(field) || value === undefined || value === null || value === "") {
      return [];
    }

    if (typeof value === "object" && ("from" in value || "to" in value)) {
      return [{
        field,
        label: labelForChangeField(field),
        from: value.from !== undefined && value.from !== null ? String(value.from) : undefined,
        to: value.to !== undefined && value.to !== null ? String(value.to) : undefined,
      }];
    }

    return [{
      field,
      label: labelForChangeField(field),
      from: undefined,
      to: String(value),
    }];
  });
};

const formatEmbeddedPaymentStatusText = (text: string) =>
  text.replace(/\bhalf[\s_-]+paid\b/gi, () => formatPaymentStatusLabel("half-paid").toLowerCase());

const formatChangeStatusValue = (change: NotificationChangeSummaryItem, value: string) =>
  isPaymentStatusField(change.field) ? formatPaymentStatusLabel(value) : value;

const formatChangeValue = (change: NotificationChangeSummaryItem) => {
  if (change.from && change.to) {
    return `${formatChangeStatusValue(change, change.from)} -> ${formatChangeStatusValue(change, change.to)}`;
  }
  if (change.to) return `Now ${formatChangeStatusValue(change, change.to)}`;
  if (change.from) return `Was ${formatChangeStatusValue(change, change.from)}`;
  return "Updated";
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  onDeleteWithResult,
  onRestore,
  onUpdateAppointmentStatus,
  onEditAppointment,
  onViewAppointmentSnapshot,
  onReschedule,
  onCancelAppointment,
  portal,
  variant = 'full'
}: NotificationItemProps) {
  // Do not fetch global doctors here to avoid triggering `/api/staff` on every
  // rendered notification. Prefer an explicit `notification.metadata.notificationImage`
  // or `notification.metadata.doctorProfile` provided when the notification is
  // created on the server. We'll fall back to DiceBear avatars.
  const isCompact = variant === 'compact';

  const statusRaw = (notification.metadata?.currentStatus || '').toString().toLowerCase();
  const status = statusRaw.replace(/[\s-]/g, '');
  const isActionTaken = ['cancelled', 'completed', 'scheduled'].includes(status);
  const isLog = notification.isLog;
  const appointmentId = (notification as any).appointmentId || notification.metadata?.appointmentId;
  const changeSummary = getNotificationChangeSummary(notification);
  const displayMessage = formatEmbeddedPaymentStatusText(notification.message);
  const hasStatusChange = changeSummary.some((change) => change.field === "status");
  const isCreatedRequest = Boolean(notification.metadata?.isRequest && changeSummary.length === 0);
  const shouldShowAppointmentActions = Boolean(
    notification.type === 'appointment' &&
    appointmentId &&
    portal !== 'patient' &&
    !isLog &&
    !notification.deleted &&
    onUpdateAppointmentStatus &&
    (hasStatusChange || isCreatedRequest) &&
    (status === 'reserved' || status === 'tbd')
  );
  const visibleChangeSummary = isCompact ? changeSummary.slice(0, 4) : changeSummary;
  const hiddenChangeCount = changeSummary.length - visibleChangeSummary.length;
  const canOpenAppointment = Boolean(
    appointmentId &&
    (notification.type === 'appointment' || notification.type === 'payment') &&
    (onViewAppointmentSnapshot || onEditAppointment)
  );

  const avatarSrc = (() => {
    try {
      const meta: any = notification.metadata || {};
      // Prefer a top-level `notificationImage` column (added server-side),
      // then fall back to metadata fields.
      if ((notification as any).notificationImage) return (notification as any).notificationImage;
      if (meta.notificationImage) return meta.notificationImage;
      if (meta.doctorProfile) return meta.doctorProfile;
    } catch (e) {}
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${notification.metadata?.patientName || notification.title}`;
  })();

  const getIcon = (type: NotificationType) => {
    const iconSize = isCompact ? "h-3 w-3" : "h-4 w-4";
    switch (type) {
      case 'appointment': return <Calendar className={`${iconSize} text-white`} />;
      case 'payment': return <CreditCard className={`${iconSize} text-white`} />;
      case 'message': return <MessageSquare className={`${iconSize} text-white`} />;
      case 'system': return <Info className={`${iconSize} text-white`} />;
      default: return <Bell className={`${iconSize} text-white`} />;
    }
  };

  const getIconBg = (type: NotificationType) => {
    switch (type) {
      case 'appointment': return 'bg-violet-600';
      case 'payment': return 'bg-emerald-600';
      case 'message': return 'bg-fuchsia-600';
      case 'system': return 'bg-slate-600';
      default: return 'bg-slate-600';
    }
  };

  const itemClasses = `group relative ${isCompact ? 'p-2' : 'p-4'} flex gap-3 transition-colors rounded-xl hover:bg-violet-100/50 ${
    canOpenAppointment ? 'cursor-pointer' : 'cursor-default'
  } ${
    isLog 
      ? 'bg-gray-50/60 border-l-2 border-gray-200 ml-2 opacity-75'
      : !notification.isRead ? 'bg-violet-50/40' : ''
  }`;

  const openAppointmentDetails = () => {
    if (!appointmentId || !canOpenAppointment) return;

    if (onViewAppointmentSnapshot) {
      onViewAppointmentSnapshot(appointmentId, notification);
    } else {
      onEditAppointment?.(appointmentId);
    }

    if (!notification.isRead && onMarkAsRead) onMarkAsRead(notification.id);
  };

  const handleItemClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openAppointmentDetails();
  };

  return (
    <div className={itemClasses} onClick={handleItemClick}>
      <div className="relative flex-shrink-0">
        {notification.metadata?.patientName || notification.metadata?.patientId ? (
          <PatientAvatar src={avatarSrc} name={notification.metadata?.patientName || notification.title} dob={notification.metadata?.patientDateOfBirth || notification.metadata?.patientDob || notification.metadata?.patientBirthDate || notification.metadata?.patientBirthday} className={`${isCompact ? 'h-12 w-12' : 'h-14 w-14'} border border-gray-100`} sizeClass={`${isCompact ? 'h-12 w-12' : 'h-14 w-14'}`} />
        ) : (
          <Avatar className={`${isCompact ? 'h-12 w-12' : 'h-14 w-14'} border border-gray-100`}>
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>{notification.title.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
        <div className={`absolute -bottom-1 -right-1 ${isCompact ? 'p-0.5' : 'p-1'} rounded-full border-2 border-white ${getIconBg(notification.type as NotificationType)}`}>
          {getIcon(notification.type as NotificationType)}
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${isCompact ? 'pr-6 py-0.5' : 'pr-8'}`}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className={`${isCompact ? 'text-xs line-clamp-3' : 'text-sm'} leading-snug ${!notification.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
              {displayMessage}
            </p>
            {isLog && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${isCompact ? 'text-[10px]' : 'text-xs'} font-medium bg-gray-200 text-gray-700 flex-shrink-0`}>
                Log
              </span>
            )}
          </div>
          <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} ${!notification.isRead ? 'text-violet-600 font-medium' : 'text-gray-500'}`}>
            {formatWordyDate(isLog ? notification.createdAt : (notification.updatedAt || notification.createdAt), {
              includeTime: true,
              fallback: "No date",
            })}
          </span>
        </div>

        {visibleChangeSummary.length > 0 && (
          <div className={`${isCompact ? 'mt-1.5 space-y-0.5 text-[10px]' : 'mt-2 space-y-1 text-xs'} text-gray-600`}>
            {visibleChangeSummary.map((change) => {
              const value = formatChangeValue(change);
              const title = `${change.label}: ${value}`;

              return (
                <div key={`${change.field}-${change.label}`} className="grid grid-cols-[auto,minmax(0,1fr)] gap-x-1.5 leading-snug">
                  <span className="font-semibold text-gray-700">{change.label}:</span>
                  <span className={`min-w-0 ${isCompact ? 'line-clamp-1' : 'line-clamp-2'}`} title={title}>
                    {value}
                  </span>
                </div>
              );
            })}
            {hiddenChangeCount > 0 && (
              <div className="font-medium text-gray-500">
                +{hiddenChangeCount} more change{hiddenChangeCount === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )}

        {notification.type === 'appointment' &&
         notification.metadata?.appointmentId &&
         portal !== 'patient' &&
         !isLog &&
         shouldShowAppointmentActions && (
            <div className={`mt-2 flex gap-2`}>
              {onUpdateAppointmentStatus && (
                <>
                  <Button 
                    size="sm" 
                    disabled={isActionTaken}
                    className={`${isCompact ? 'h-7 text-[10px]' : 'h-9'} flex-1 font-semibold rounded-lg ${
                      status === 'scheduled'
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600 disabled:text-white disabled:cursor-not-allowed"
                        : "bg-violet-600 hover:bg-violet-700 text-white disabled:bg-violet-200"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isActionTaken) {
                        onUpdateAppointmentStatus(notification.metadata!.appointmentId!, 'scheduled', notification.id);
                      }
                    }}
                  >
                    {status === 'tbd' ? 'Mark Completed' : status === 'reserved' ? 'Accept & Schedule' : 'Accept'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    disabled={isActionTaken}
                    className={`${isCompact ? 'h-7 text-[10px]' : 'h-9'} flex-1 font-semibold rounded-lg ${
                      status === 'cancelled'
                        ? "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-600 disabled:text-white disabled:cursor-not-allowed"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isActionTaken) {
                        onUpdateAppointmentStatus(notification.metadata!.appointmentId!, 'cancelled', notification.id);
                      }
                    }}
                  >
                    {status === 'cancelled' ? 'Declined' : 'Decline'}
                  </Button>
                </>
              )}
              {canOpenAppointment && !isCompact && ['reserved','halfpaid','topay'].includes(status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 font-semibold rounded-lg border border-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAppointmentDetails();
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" /> View
                </Button>
              )}
            </div>
        )}
      </div>

      <div className={`absolute ${isCompact ? 'right-1 top-2' : 'right-4 top-1/2 -translate-y-1/2'} flex flex-col items-center gap-2`}>
        {!isLog && !notification.isRead && (
          <div className={`${isCompact ? 'w-2 h-2' : 'w-3 h-3'} rounded-full bg-violet-600`}></div>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`${isCompact ? 'h-6 w-6' : 'h-8 w-8 bg-white shadow-sm border border-gray-100'} rounded-full focus:opacity-100 transition-opacity ${isLog ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} text-gray-500`} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Only show these options if notification is NOT deleted */}
            {!notification.deleted && (
              <>
                {canOpenAppointment && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    openAppointmentDetails();
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    <span className="text-sm">View Snapshot</span>
                  </DropdownMenuItem>
                )}
                {!notification.isRead && onMarkAsRead && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}>
                    <Check className="h-4 w-4 mr-2" />
                    <span className="text-sm">Mark as read</span>
                  </DropdownMenuItem>
                )}
                {notification.isRead && onMarkAsUnread && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsUnread(notification.id);
                  }}>
                    <Bell className="h-4 w-4 mr-2" />
                    <span className="text-sm">Mark as unread</span>
                  </DropdownMenuItem>
                )}

                {!isLog && notification.type === 'appointment' && notification.metadata?.appointmentId && !(portal === 'patient' && (notification.type !== 'appointment' || !notification.metadata?.appointmentId || status === 'cancelled')) && (
                  <>
                    {portal !== 'patient' && onUpdateAppointmentStatus && (
                      <>
                        {shouldShowAppointmentActions && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onUpdateAppointmentStatus(notification.metadata!.appointmentId!, 'scheduled', notification.id);
                          }}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            <span className="text-sm">{status === 'tbd' ? 'Mark Completed' : 'Accept Appointment'}</span>
                          </DropdownMenuItem>
                        )}
                        {shouldShowAppointmentActions && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onUpdateAppointmentStatus(notification.metadata!.appointmentId!, 'cancelled', notification.id);
                          }}>
                            <X className="h-4 w-4 mr-2 text-red-600" />
                            <span className="text-sm">{['scheduled'].includes(status) ? 'Cancel Appointment' : 'Decline Request'}</span>
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    
                    {portal === 'patient' && status !== 'cancelled' && (
                      <>
                        {onReschedule && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onReschedule(notification.metadata!.appointmentId!);
                          }}>
                            <Edit2 className="h-4 w-4 mr-2 text-violet-600" />
                            <span className="text-sm">Reschedule</span>
                          </DropdownMenuItem>
                        )}
                        {onCancelAppointment && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onCancelAppointment(notification.metadata!.appointmentId!);
                          }}>
                            <Ban className="h-4 w-4 mr-2 text-red-600" />
                            <span className="text-sm">Cancel Appointment</span>
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </>
                )}

                {(
                  onDeleteWithResult ? (
                    <DropdownMenuItem 
                      className="text-red-600 focus:text-red-600" 
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await onDeleteWithResult(notification.id);
                        } catch (err) {
                          console.error('[NotificationItem] onDeleteWithResult error:', err);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span className="text-sm">Delete notification</span>
                    </DropdownMenuItem>
                  ) : onDelete ? (
                    <DropdownMenuItem 
                      className="text-red-600 focus:text-red-600" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span className="text-sm">Delete notification</span>
                    </DropdownMenuItem>
                  ) : null
                )}
              </>
            )}

            {/* Show restore option only if notification IS deleted */}
            {notification.deleted && onRestore && (
              <DropdownMenuItem 
                className="text-violet-600 focus:text-violet-600" 
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(notification.id);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                <span className="text-sm">Restore notification</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
