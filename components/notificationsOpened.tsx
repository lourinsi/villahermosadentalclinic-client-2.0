"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, Loader, MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Notification } from "../lib/notification-types";
import NotificationsMenuContent from "./NotificationsMenuContent";
import { useNotificationLogic } from "../hooks/useNotificationLogic";
import { NotificationItem } from "./NotificationItem";

interface NotificationsOpenedProps {
  notifications: Notification[];
  unreadCount: number;
  portal: "admin" | "doctor" | "patient";
  onUpdateAppointmentStatus?: (appointmentId: string, status: string, notificationId: string) => void;
  onMarkAsRead?: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDeleteWithResult?: (id: string) => Promise<boolean>;
  onRestore?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDeleteAll?: () => void;
  onRefresh?: () => void;
  onReschedule?: (appointmentId: string) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  onEditAppointment?: (appointmentId: string) => void;
  onViewAppointmentSnapshot?: (appointmentId: string, notification: Notification) => void | Promise<void>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
}

const NOTIFICATIONS_PAGE_SIZE = 10;

function NotificationsOpened({
  notifications,
  unreadCount,
  portal,
  onUpdateAppointmentStatus,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  onDeleteWithResult,
  onRestore,
  onMarkAllAsRead,
  onDeleteAll,
  onRefresh,
  onReschedule,
  onCancelAppointment,
  onEditAppointment,
  onViewAppointmentSnapshot,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: NotificationsOpenedProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PAGE_SIZE);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const scrollRootRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = React.useRef(false);

  const compactNotifications = notifications ? notifications.filter((n) => !n.deleted) : [];
  const {
    filter,
    setFilter,
    filteredNotifications,
    newNotifications,
  } = useNotificationLogic(compactNotifications);

  const visibleNotifications = React.useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount]
  );
  const newNotificationIds = React.useMemo(
    () => new Set(newNotifications.map((notification) => notification.id)),
    [newNotifications]
  );
  const visibleNew = visibleNotifications.filter((notification) => newNotificationIds.has(notification.id));
  const visibleEarlier = visibleNotifications.filter((notification) => !newNotificationIds.has(notification.id));
  const hasMoreLoadedNotifications = visibleCount < filteredNotifications.length;
  const canLoadMore = hasMoreLoadedNotifications || isLoadingMore || Boolean(hasMore && onLoadMore);

  const handleViewAppointmentSnapshot = (appointmentId: string, notification: Notification) => {
    setIsPopoverOpen(false);
    onViewAppointmentSnapshot?.(appointmentId, notification);
  };

  const handleUpdateAppointmentStatus = (appointmentId: string, status: string, notificationId: string) => {
    setIsPopoverOpen(false);
    onUpdateAppointmentStatus?.(appointmentId, status, notificationId);
  };

  const renderItem = (notification: Notification) => (
    <NotificationItem
      key={notification.id}
      notification={notification}
      onMarkAsRead={onMarkAsRead}
      onMarkAsUnread={onMarkAsUnread}
      onDelete={onDelete}
      onDeleteWithResult={onDeleteWithResult}
      onRestore={onRestore}
      onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
      onEditAppointment={onEditAppointment}
      onViewAppointmentSnapshot={handleViewAppointmentSnapshot}
      onReschedule={onReschedule}
      onCancelAppointment={onCancelAppointment}
      portal={portal}
      variant="compact"
    />
  );

  const handleLoadMore = React.useCallback(async () => {
    if (isLoadingMore || loadMoreInFlightRef.current) return;

    if (visibleCount < filteredNotifications.length) {
      setVisibleCount((count) => Math.min(count + NOTIFICATIONS_PAGE_SIZE, filteredNotifications.length));
      return;
    }

    if (!hasMore || !onLoadMore) return;

    loadMoreInFlightRef.current = true;
    try {
      await onLoadMore();
    } finally {
      loadMoreInFlightRef.current = false;
    }
  }, [filteredNotifications.length, hasMore, isLoadingMore, onLoadMore, visibleCount]);

  React.useEffect(() => {
    if (!isPopoverOpen || !canLoadMore || isLoadingMore) return;

    const root = scrollRootRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void handleLoadMore();
        }
      },
      { root, rootMargin: "120px 0px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    canLoadMore,
    filteredNotifications.length,
    handleLoadMore,
    isLoadingMore,
    isPopoverOpen,
    visibleNotifications.length,
  ]);

  React.useEffect(() => {
    if (isPopoverOpen) {
      setVisibleCount(NOTIFICATIONS_PAGE_SIZE);
    }
  }, [filter, isPopoverOpen]);

  const renderLoadMoreSentinel = () => {
    if (!canLoadMore) return null;

    return (
      <div ref={loadMoreSentinelRef} className="flex h-9 items-center justify-center py-2">
        {isLoadingMore && <Loader className="h-4 w-4 animate-spin text-violet-600" />}
      </div>
    );
  };

  React.useEffect(() => {
    if (!isMenuOpen) return;

    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen]);

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-gray-100 hover:bg-gray-200"
          onClick={() => {
            setIsPopoverOpen(!isPopoverOpen);
            if (!isPopoverOpen) onRefresh?.();
          }}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border-2 border-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0 shadow-xl rounded-xl border-gray-200"
        align="end"
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="text-xl font-bold">Notifications</h4>
          <div className="relative">
            <Button
              ref={menuButtonRef as any}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-gray-100"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-5 w-5 text-gray-500" />
            </Button>

            {isMenuOpen && (
              <div ref={menuRef} className="absolute right-0 mt-2 z-30">
                <NotificationsMenuContent
                  renderMode="inline"
                  showMarkAll={true}
                  onMarkAllAsRead={() => {
                    onMarkAllAsRead?.();
                    setIsMenuOpen(false);
                  }}
                  onDeleteAll={() => {
                    onDeleteAll?.();
                    setIsMenuOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex px-4 gap-2 mb-2 flex-wrap">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            className={`rounded-full font-semibold h-8 ${filter === "all" ? "bg-violet-50 text-violet-600 hover:bg-violet-100" : "text-gray-600 hover:bg-gray-100"}`}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "secondary" : "ghost"}
            size="sm"
            className={`rounded-full font-semibold h-8 ${filter === "unread" ? "bg-violet-50 text-violet-600 hover:bg-violet-100" : "text-gray-600 hover:bg-gray-100"}`}
            onClick={() => setFilter("unread")}
          >
            Unread
          </Button>
          {(portal === "admin" || portal === "doctor") && (
            <>
              <Button
                variant={filter === "appointment" ? "secondary" : "ghost"}
                size="sm"
                className={`rounded-full font-semibold h-8 ${filter === "appointment" ? "bg-violet-50 text-violet-600 hover:bg-violet-100" : "text-gray-600 hover:bg-gray-100"}`}
                onClick={() => setFilter("appointment")}
              >
                Appointments
              </Button>
              <Button
                variant={filter === "payment" ? "secondary" : "ghost"}
                size="sm"
                className={`rounded-full font-semibold h-8 ${filter === "payment" ? "bg-violet-50 text-violet-600 hover:bg-violet-100" : "text-gray-600 hover:bg-gray-100"}`}
                onClick={() => setFilter("payment")}
              >
                Payments
              </Button>
            </>
          )}
        </div>

        <div ref={scrollRootRef} className="max-h-[450px] overflow-y-auto p-2 scrollbar-hide">
          {visibleNew.length === 0 && visibleEarlier.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              No notifications to show
            </div>
          ) : (
            <div className="space-y-4">
              {visibleNew.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2">
                    <span className="font-bold text-sm">New</span>
                    <Link href={`/${portal}/notifications`} prefetch={false} className="text-violet-600 text-xs font-medium hover:underline">See all</Link>
                  </div>
                  {visibleNew.map(renderItem)}
                </div>
              )}

              {visibleEarlier.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2">
                    <span className="font-bold text-sm">Earlier</span>
                  </div>
                  {visibleEarlier.map(renderItem)}
                </div>
              )}
            </div>
          )}
          {renderLoadMoreSentinel()}
        </div>
        <div className="p-2 border-t">
          <Link href={`/${portal}/notifications`} prefetch={false} className="block">
            <Button variant="ghost" size="sm" className="w-full text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-semibold rounded-lg">
              View all notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationsOpened;
