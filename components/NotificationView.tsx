"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Notification } from "../lib/notification-types";
import { Appointment } from "@/hooks/useAppointments";
import { useNotificationLogic } from "../hooks/useNotificationLogic";
import { NotificationItem } from "./NotificationItem";
import { Bell, MoreHorizontal, Check, Trash2, Loader } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import NotificationsMenuContent from "./NotificationsMenuContent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface NotificationViewProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteAll?: () => void;
  onUpdateAppointmentStatus?: (appointmentId: string, status: Appointment["status"], notificationId: string) => void;
  onReschedule?: (appointmentId: string) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  onEditAppointment?: (appointmentId: string) => void;
  onViewAppointmentSnapshot?: (appointmentId: string, notification: Notification) => void | Promise<void>;
  onRestore?: (id: string) => void;
  portal?: 'admin' | 'doctor' | 'patient';
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onDeleteWithResult?: (id: string) => Promise<boolean>;
  onLoadMore?: () => void | Promise<void>;
}

export function NotificationView({ 
  notifications, 
  onMarkAsRead,
  onMarkAsUnread,
  onDelete, 
  onMarkAllAsRead,
  onDeleteAll,
  onDeleteWithResult,
  onUpdateAppointmentStatus,
  onReschedule,
  onCancelAppointment,
  onEditAppointment,
  onViewAppointmentSnapshot,
  onRestore,
  portal = 'admin',
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  error = null,
  onLoadMore
}: NotificationViewProps) {
  const [activeTab, setActiveTab] = useState('notifications');
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);
  // Track IDs we've optimistically marked deleted so parent prop updates don't overwrite them
  const optimisticDeletedRef = React.useRef<Set<string>>(new Set());

  // Watch for changes in the notifications prop and update local state
  useEffect(() => {
    // Merge incoming parent notifications with our optimistic delete markers so
    // optimistic deletions aren't overwritten by parent refreshes.
    try {
      if (!notifications) return;

      console.log('[NotificationView] 📥 Notifications updated from parent (merging optimistic state)');
      console.log('[NotificationView] Incoming total:', notifications.length);

      // Build a map of incoming notifications
      const incomingMap = new Map<string, Notification>();
      notifications.forEach(n => incomingMap.set(n.id, { ...n }));

      // Start with incoming notifications and apply optimistic deleted flags
      const merged: Notification[] = notifications.map(n => {
        if (optimisticDeletedRef.current.has(n.id)) {
          // keep the optimistic deleted flag until server confirms
          return { ...n, deleted: true, deletedAt: n.deletedAt || new Date().toISOString() };
        }
        return { ...n };
      });

      // There may be local notifications created optimistically that the server hasn't returned yet
      // (rare). Include any local-only entries so UI doesn't lose them.
      localNotifications.forEach(local => {
        if (!incomingMap.has(local.id)) {
          // keep local-only entries (e.g., newly added notifications) in the merged list
          merged.push(local);
        }
      });

      // If server now reports an item as deleted, clear its optimistic marker
      merged.forEach(m => {
        if (m.deleted && optimisticDeletedRef.current.has(m.id)) {
          optimisticDeletedRef.current.delete(m.id);
        }
      });

      setLocalNotifications(merged.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      }));
    } catch (err) {
      console.error('[NotificationView] Error merging notifications:', err);
    }
  }, [notifications]);

  // No auto-switch: localNotifications updates immediately when onDelete is triggered,
  // so the Deleted tab content updates without changing the user's active tab.

  const handleTabChange = (tabValue: string) => {
    console.log(`[NotificationView] Tab changed to: ${tabValue}`);
    if (tabValue === 'deleted') {
      const deletedCount = localNotifications.filter(n => n.deleted).length;
      console.log(`[NotificationView] Viewing deleted notifications - Total deleted: ${deletedCount}`);
    } else {
      const activeCount = localNotifications.filter(n => !n.deleted).length;
      console.log(`[NotificationView] Viewing active notifications - Total active: ${activeCount}`);
    }
    setActiveTab(tabValue);
  };

  // Only call useNotificationLogic if we have notifications to avoid errors
  const { 
    filter, 
    setFilter, 
    filteredNotifications, 
    newNotifications, 
    earlierNotifications 
  } = useNotificationLogic(localNotifications.filter(n => !n.deleted) || []);

  // Separate deleted notifications
  const deletedNotifications = localNotifications.filter(n => n.deleted);
  const deletedNew = deletedNotifications.filter(n => !n.isRead);
  const deletedEarlier = deletedNotifications.filter(n => n.isRead);

  const handleDeleteLocal = async (id: string) => {
    console.log('[NotificationView] Optimistically marking notification deleted:', id);
    // remember this id so incoming props don't overwrite the optimistic delete
    optimisticDeletedRef.current.add(id);
    const previous = localNotifications;
    setLocalNotifications(prev => prev.map(n => n.id === id ? { ...n, deleted: true, deletedAt: new Date().toISOString() } : n));

    // If caller provides a promise-returning delete, await it and rollback on failure
    if (onDeleteWithResult) {
      const success = await onDeleteWithResult(id);
      if (!success) {
        console.error('[NotificationView] Server delete failed, rolling back optimistic delete for', id);
        // remove optimistic marker and restore previous state
        optimisticDeletedRef.current.delete(id);
        setLocalNotifications(previous);
      }
      return;
    }

    // Fallback: call parent fire-and-forget
    try {
      onDelete(id);
    } catch (err) {
      console.error('[NotificationView] onDelete threw an error:', err);
    }
  };

  const renderItem = (notification: Notification) => (
    <NotificationItem
      key={notification.id}
      notification={notification}
      onMarkAsRead={onMarkAsRead}
      onMarkAsUnread={onMarkAsUnread}
      onDelete={handleDeleteLocal}
      onRestore={onRestore}
      onUpdateAppointmentStatus={onUpdateAppointmentStatus}
      onEditAppointment={onEditAppointment}
      onViewAppointmentSnapshot={onViewAppointmentSnapshot}
      onReschedule={onReschedule}
      onCancelAppointment={onCancelAppointment}
      portal={portal}
      variant="full"
    />
  );

  const handleLoadMore = React.useCallback(async () => {
    if (!hasMore || isLoadingMore || !onLoadMore || loadMoreInFlightRef.current) return;

    loadMoreInFlightRef.current = true;
    try {
      await onLoadMore();
    } finally {
      loadMoreInFlightRef.current = false;
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const root = scrollRootRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void handleLoadMore();
        }
      },
      { root, rootMargin: '120px 0px', threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    activeTab,
    deletedNotifications.length,
    filteredNotifications.length,
    handleLoadMore,
    hasMore,
    isLoadingMore,
    onLoadMore,
  ]);

  const renderLoadMoreSentinel = () => {
    if (!hasMore && !isLoadingMore) return null;

    return (
      <div ref={loadMoreSentinelRef} className="flex h-10 items-center justify-center py-2">
        {isLoadingMore && <Loader className="h-5 w-5 animate-spin text-violet-600" />}
      </div>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-[680px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-8">
        <div className="flex flex-col items-center justify-center">
          <Loader className="h-8 w-8 text-violet-600 animate-spin mb-4" />
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[680px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <Bell className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Failed to load notifications</h3>
          <p className="text-gray-500 mt-1">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => {
                    const options: string[] = [];
                    if (activeTab === 'notifications') options.push('Mark all as read (visible)');
                    options.push('Mark all as read (callback present)');
                    if (onDeleteAll) options.push('Clear all notifications (callback present)');
                    console.log('[NotificationView] page three-dot clicked; options:', options);
                  }}>
                    <MoreHorizontal className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                <NotificationsMenuContent showMarkAll={activeTab === 'notifications'} onMarkAllAsRead={onMarkAllAsRead} onDeleteAll={onDeleteAll} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger 
              value="notifications" 
              className="rounded-md data-[state=active]:bg-white data-[state=active]:text-violet-600 data-[state=active]:shadow-sm"
              onClick={() => handleTabChange('notifications')}
            >
              Notifications
              {localNotifications.filter(n => !n.deleted).some(n => !n.isRead) && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                  {localNotifications.filter(n => !n.deleted && !n.isRead).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="deleted" 
              className="rounded-md data-[state=active]:bg-white data-[state=active]:text-violet-600 data-[state=active]:shadow-sm"
              onClick={() => handleTabChange('deleted')}
            >
              Deleted
              {deletedNotifications.length > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-[10px] font-bold text-white">
                  {deletedNotifications.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'notifications' && (
            <div className="flex gap-2 flex-wrap mt-4">
              <Button 
                variant={filter === 'all' ? 'secondary' : 'ghost'} 
                className={`rounded-full px-4 h-9 font-semibold ${filter === 'all' ? 'bg-violet-50 text-violet-600 hover:bg-violet-100' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button 
                variant={filter === 'unread' ? 'secondary' : 'ghost'} 
                className={`rounded-full px-4 h-9 font-semibold ${filter === 'unread' ? 'bg-violet-50 text-violet-600 hover:bg-violet-100' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setFilter('unread')}
              >
                Unread
              </Button>
              {(portal === 'admin' || portal === 'doctor') && (
                <>
                  <Button 
                    variant={filter === 'appointment' ? 'secondary' : 'ghost'} 
                    className={`rounded-full px-4 h-9 font-semibold ${filter === 'appointment' ? 'bg-violet-50 text-violet-600 hover:bg-violet-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setFilter('appointment')}
                  >
                    Appointments
                  </Button>
                  <Button 
                    variant={filter === 'payment' ? 'secondary' : 'ghost'} 
                    className={`rounded-full px-4 h-9 font-semibold ${filter === 'payment' ? 'bg-violet-50 text-violet-600 hover:bg-violet-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setFilter('payment')}
                  >
                    Payments
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <TabsContent
          value="notifications"
          ref={activeTab === 'notifications' ? scrollRootRef : undefined}
          className="p-2 overflow-y-auto max-h-[calc(100vh-200px)]"
        >
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <Bell className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
              <p className="text-gray-500">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {newNotifications.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-2">
                    <h2 className="font-bold text-gray-900">New</h2>
                    <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-medium h-auto p-0" onClick={onMarkAllAsRead}>
                      Mark all as read
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {newNotifications.map(renderItem)}
                  </div>
                </div>
              )}
              
              {earlierNotifications.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-2">
                    <h2 className="font-bold text-gray-900">Earlier</h2>
                  </div>
                  <div className="space-y-1">
                    {earlierNotifications.map(renderItem)}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'notifications' && renderLoadMoreSentinel()}
        </TabsContent>

        <TabsContent
          value="deleted"
          ref={activeTab === 'deleted' ? scrollRootRef : undefined}
          className="p-2 overflow-y-auto max-h-[calc(100vh-200px)]"
        >
          {deletedNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <Trash2 className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No deleted notifications</h3>
              <p className="text-gray-500">Your deleted notifications will appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {deletedNew.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-2">
                    <h2 className="font-bold text-gray-900">Recently Deleted</h2>
                  </div>
                  <div className="space-y-1">
                    {deletedNew.map(renderItem)}
                  </div>
                </div>
              )}
              
              {deletedEarlier.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-2">
                    <h2 className="font-bold text-gray-900">Older</h2>
                  </div>
                  <div className="space-y-1">
                    {deletedEarlier.map(renderItem)}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'deleted' && renderLoadMoreSentinel()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
