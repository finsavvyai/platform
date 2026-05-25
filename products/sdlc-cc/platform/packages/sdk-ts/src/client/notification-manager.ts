// Notification and service worker management for the Browser SDLC Client

import type { Notification as SDLCNotification } from '../types';

interface SDLCNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export type BrowserNotificationPayload = Omit<
  SDLCNotification,
  'id' | 'createdAt'
> & {
  title: string;
  body?: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: SDLCNotificationAction[];
  silent?: boolean;
};

/**
 * Show a browser notification using the Notification API.
 */
export async function showNotification(
  notification: BrowserNotificationPayload
): Promise<void> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    const browserNotification = new Notification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      requireInteraction: notification.requireInteraction,
      silent: notification.silent,
      data: notification.data,
      ...(notification.image ? { image: notification.image } : {}),
    } as NotificationOptions);

    if (!notification.requireInteraction) {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }

    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
    };
  }
}

export interface ServiceWorkerMessageHandler {
  (type: string, data: unknown): void;
}

/**
 * Handle incoming service worker messages by type.
 */
export function handleServiceWorkerMessage(
  event: MessageEvent,
  emit: (event: string, data: unknown) => void
): void {
  switch (event.data.type) {
    case 'cacheUpdate':
      emit('cacheUpdate', event.data);
      break;
    case 'pushNotification':
      emit('pushNotification', event.data);
      break;
    case 'syncComplete':
      emit('syncComplete', event.data);
      break;
  }
}
