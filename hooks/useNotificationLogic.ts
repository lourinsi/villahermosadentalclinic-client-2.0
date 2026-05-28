"use client";

import { useState, useMemo } from 'react';
import { Notification } from '../lib/notification-types';
import { subHours, isAfter } from 'date-fns';

export type NotificationFilter = 'all' | 'unread' | 'appointment' | 'payment';

export function useNotificationLogic(notifications: Notification[]) {
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        if (filter === 'unread') return !n.isRead;
        if (filter === 'appointment') return n.type === 'appointment';
        if (filter === 'payment') return n.type === 'payment';
        return true;
      })
      .sort((a, b) => {
        // For logged notifications, use createdAt. For active, use updatedAt or createdAt.
        const dateA = a.isLog ? new Date(a.createdAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = b.isLog ? new Date(b.createdAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA; // Newest first
      });
  }, [notifications, filter]);

  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24);

  const newNotifications = useMemo(() => {
    return filteredNotifications.filter(n => 
      isAfter(new Date(n.isLog ? n.createdAt : (n.updatedAt || n.createdAt)), twentyFourHoursAgo)
    );
  }, [filteredNotifications, twentyFourHoursAgo]);
  
  const earlierNotifications = useMemo(() => {
    return filteredNotifications.filter(n => 
      !isAfter(new Date(n.isLog ? n.createdAt : (n.updatedAt || n.createdAt)), twentyFourHoursAgo)
    );
  }, [filteredNotifications, twentyFourHoursAgo]);

  return {
    filter,
    setFilter,
    filteredNotifications,
    newNotifications,
    earlierNotifications
  };
}
