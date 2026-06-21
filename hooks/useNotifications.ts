import { apiUrl } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";
import { Notification } from "@/lib/notification-types";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

interface UseNotificationsOptions {
  enabled?: boolean;
  includeDeleted?: boolean;
  limit?: number;
}

interface NotificationsMeta {
  total?: number;
  unreadCount?: number;
  limit?: number | null;
  offset?: number;
  hasMore?: boolean;
}

export const useNotifications = (options?: UseNotificationsOptions) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<NotificationsMeta>({});
  const [nextOffset, setNextOffset] = useState(0);
  const enabled = options?.enabled ?? true;
  const includeDeleted = options?.includeDeleted ?? false;
  const limit = options?.limit ?? 10;

  const userId = user?.patientId || user?.staffId || user?.username;

  const fetchNotificationsPage = useCallback(async (offset = 0, append = false) => {
    if (!enabled) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    // Don't proceed if userId is not available
    if (!userId) {
      setIsLoading(false);
      setIsLoadingMore(false);
      setError(null);
      setNotifications([]);
      setMeta({});
      setNextOffset(0);
      return;
    }

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const params = new URLSearchParams({ userId });
      if (includeDeleted) params.set("includeDeleted", "true");
      if (limit) params.set("limit", String(limit));
      if (limit && offset > 0) params.set("offset", String(offset));

      const response = await fetch(apiUrl(`/api/notifications?${params.toString()}`), { credentials: 'include' });
      if (!response.ok) {
        const text = await response.text();
        console.error(`[useNotifications] Fetch failed: ${response.status} - ${text}`);
        throw new Error(`Failed to fetch notifications: ${response.status} ${text}`);
      }

      const data = await response.json();
      if (data.success) {
        const incoming = Array.isArray(data.data) ? data.data : [];
        setNotifications(prev => {
          if (!append) return incoming;

          const seen = new Set(prev.map(notification => notification.id));
          const merged = [...prev];
          incoming.forEach((notification: Notification) => {
            if (!seen.has(notification.id)) {
              seen.add(notification.id);
              merged.push(notification);
            }
          });
          return merged;
        });

        const responseMeta: NotificationsMeta = data.meta || {};
        const fallbackHasMore = Boolean(limit && incoming.length === limit);
        setMeta({
          ...responseMeta,
          hasMore: responseMeta.hasMore ?? fallbackHasMore,
          unreadCount: responseMeta.unreadCount,
          total: responseMeta.total,
        });
        setNextOffset(offset + incoming.length);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load notifications";
      console.error("Error fetching notifications:", error);
      setError(errorMessage);
      toast.error("Failed to load notifications");
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [enabled, includeDeleted, limit, userId]);

  const fetchNotifications = useCallback(async () => {
    await fetchNotificationsPage(0, false);
  }, [fetchNotificationsPage]);

  const loadMoreNotifications = useCallback(async () => {
    if (!limit || isLoading || isLoadingMore || !meta.hasMore) return;
    await fetchNotificationsPage(nextOffset, true);
  }, [fetchNotificationsPage, isLoading, isLoadingMore, limit, meta.hasMore, nextOffset]);

  // Listen for global notification changes (from other hook instances) and refetch
  useEffect(() => {
    const onNotificationsChanged = () => {
      // Re-fetch to keep this hook instance in sync with others
      if (enabled && userId) fetchNotifications();
    };

    // Create a shared bus on the window object to avoid multiple isolated instances
    const busKey = "__villahermosa_notifications_bus__";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!globalThis[busKey]) globalThis[busKey] = new EventTarget();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const bus: EventTarget = globalThis[busKey];

    bus.addEventListener("notifications-changed", onNotificationsChanged as EventListener);
    return () => {
      bus.removeEventListener("notifications-changed", onNotificationsChanged as EventListener);
    };
  }, [enabled, fetchNotifications, userId]);

  useEffect(() => {
    if (enabled && userId) {
      fetchNotifications();
    }
  }, [enabled, userId, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const wasUnread = notifications.some(n => n.id === id && !n.isRead && !n.deleted);
      const response = await fetch(apiUrl(`/api/notifications/${id}`), {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (!response.ok) throw new Error("Failed to mark notification as read");
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setMeta(prev => ({
        ...prev,
        unreadCount: wasUnread
          ? Math.max(0, (prev.unreadCount ?? notifications.filter(n => !n.isRead && !n.deleted).length) - 1)
          : prev.unreadCount,
      }));
  // notify other hook instances
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { id, action: 'markAsRead' } }));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to update notification");
    }
  };

  const markAsUnread = async (id: string) => {
    try {
      const wasRead = notifications.some(n => n.id === id && n.isRead && !n.deleted);
      const response = await fetch(apiUrl(`/api/notifications/${id}`), {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: false }),
      });

      if (!response.ok) throw new Error("Failed to mark notification as unread");
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
      setMeta(prev => ({
        ...prev,
        unreadCount: wasRead
          ? (prev.unreadCount ?? notifications.filter(n => !n.isRead && !n.deleted).length) + 1
          : prev.unreadCount,
      }));
      toast.success("Marked as unread");
    // notify other hook instances
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { id, action: 'markAsUnread' } }));
    } catch (error) {
      console.error("Error marking notification as unread:", error);
      toast.error("Failed to update notification");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const wasUnread = notifications.some(n => n.id === id && !n.isRead && !n.deleted);
      const response = await fetch(apiUrl(`/api/notifications/${id}`), {
        method: "DELETE",
        credentials: 'include',
      });

      if (!response.ok) throw new Error("Failed to delete notification");
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      setMeta(prev => ({
        ...prev,
        total: prev.total !== undefined && !includeDeleted ? Math.max(0, prev.total - 1) : prev.total,
        unreadCount: wasUnread
          ? Math.max(0, (prev.unreadCount ?? notifications.filter(n => !n.isRead && !n.deleted).length) - 1)
          : prev.unreadCount,
      }));
      toast.success("Notification deleted");
    // notify other hook instances
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { id, action: 'delete' } }));
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    try {
      const response = await fetch(apiUrl(`/api/notifications/mark-all-read?userId=${userId}`), {
        method: "PUT",
        credentials: 'include',
      });

      if (!response.ok) throw new Error("Failed to mark all as read");
      
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setMeta(prev => ({ ...prev, unreadCount: 0 }));
      toast.success("All notifications marked as read");
    // notify other hook instances
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { action: 'markAllAsRead' } }));
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to update notifications");
    }
  };

  const deleteAllNotifications = async () => {
    if (!userId) return;

    try {
      const response = await fetch(apiUrl(`/api/notifications?userId=${userId}`), {
        method: "DELETE",
        credentials: 'include',
      });

      if (!response.ok) throw new Error("Failed to delete all notifications");
      
      setNotifications([]);
      setMeta(prev => ({ ...prev, total: 0, unreadCount: 0, hasMore: false }));
      setNextOffset(0);
      toast.success("All notifications cleared");
    // notify other hook instances
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { action: 'deleteAll' } }));
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      toast.error("Failed to clear notifications");
    }
  };

  const restoreNotification = async (id: string) => {
    try {
      const response = await fetch(apiUrl(`/api/notifications/${id}/restore`), {
        method: "PUT",
        credentials: 'include',
      });

      if (!response.ok) throw new Error("Failed to restore notification");
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, deleted: false, deletedAt: undefined } : n));
      setMeta(prev => ({
        ...prev,
        total: prev.total !== undefined && !includeDeleted ? prev.total + 1 : prev.total,
      }));
      toast.success("Notification restored");
    // notify other hook instances
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { id, action: 'restore' } }));
    } catch (error) {
      console.error("Error restoring notification:", error);
      toast.error("Failed to restore notification");
    }
  };

  // Return boolean success so callers can perform optimistic UI and rollback on failure
  const deleteNotificationWithResult = async (id: string): Promise<boolean> => {
    try {
      const wasUnread = notifications.some(n => n.id === id && !n.isRead && !n.deleted);
      const response = await fetch(apiUrl(`/api/notifications/${id}`), {
        method: "DELETE",
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(`[useNotifications] Failed to delete notification ${id}:`, response.status, text);
        toast.error("Failed to delete notification");
        return false;
      }

  setNotifications(prev => prev.filter(n => n.id !== id));
      setMeta(prev => ({
        ...prev,
        total: prev.total !== undefined && !includeDeleted ? Math.max(0, prev.total - 1) : prev.total,
        unreadCount: wasUnread
          ? Math.max(0, (prev.unreadCount ?? notifications.filter(n => !n.isRead && !n.deleted).length) - 1)
          : prev.unreadCount,
      }));
      toast.success("Notification deleted");
  // notify other hook instances
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis["__villahermosa_notifications_bus__"]?.dispatchEvent(new CustomEvent("notifications-changed", { detail: { id, action: 'delete' } }));
      return true;
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
      return false;
    }
  };

  return {
    notifications,
    isLoading,
    isLoadingMore,
    error,
    hasMore: Boolean(meta.hasMore),
    totalCount: meta.total,
    unreadCount: meta.unreadCount,
    markAsRead,
    markAsUnread,
    deleteNotification,
  deleteNotificationWithResult,
    markAllAsRead,
    deleteAllNotifications,
    restoreNotification,
    refreshNotifications: fetchNotifications,
    loadMoreNotifications,
  };
};
