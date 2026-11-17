// Web notification implementation without importing native expo-notifications
import { getApiUrl } from '../config';
export type NotificationBannerData = {
  id: string;
  title: string;
  body: string;
  type?: 'success' | 'call' | 'info';
  timestamp: number;
};

type BannerListener = (banner: NotificationBannerData) => void;
const bannerListeners = new Set<BannerListener>();

export function subscribeToNotificationBanners(listener: BannerListener) {
  bannerListeners.add(listener);
  return () => {
    bannerListeners.delete(listener);
  };
}

function dispatchInAppBanner(title: string, body: string, type: 'success' | 'call' | 'info' = 'info') {
  const banner: NotificationBannerData = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    body,
    type,
    timestamp: Date.now()
  };
  bannerListeners.forEach((listener) => {
    try {
      listener(banner);
    } catch (e) {
      console.warn('Notification banner error:', e);
    }
  });
}

export async function setupNotifications() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore
      }
    }
  }
}

export async function triggerRegistrationNotification(workerName: string, category: string) {
  const title = '🎉 Profile Registered Successfully!';
  const body = `Welcome ${workerName}! Your profile is now live in the Quick Karya ${category} proximity directory.`;

  dispatchInAppBanner(title, body, 'success');

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/assets/icon.png'
      });
    } catch {
      // Fallback
    }
  }
}

export async function triggerCallWorkerNotification(
  workerName: string,
  workerPhone: string,
  category?: string,
  customerName?: string,
  customerPhone?: string,
  actionType: 'call' | 'gps_share' = 'call'
) {
  const callerName = customerName || 'Customer';
  const callerPhone = customerPhone || '';
  const isGpsShare = actionType === 'gps_share';

  const bannerTitle = isGpsShare
    ? 'Quick Karya - GPS & Service Request Sent'
    : 'Quick Karya - Call Service Alert Sent';
  const bannerBody = isGpsShare
    ? `Incoming service request & live GPS pin shared with ${workerName} (${category || 'Artisan'}) from ${callerName}.`
    : `Connecting call to ${workerName} (${category || 'Artisan'}). Service alert dispatched from ${callerName}.`;

  // Trigger immediate in-app banner alert
  dispatchInAppBanner(bannerTitle, bannerBody, 'call');

  try {
    await fetch(getApiUrl('/api/notifications/notify-worker'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerName,
        workerPhone,
        category,
        customerName: callerName,
        customerPhone: callerPhone,
        actionType
      })
    });
  } catch (err) {
    console.warn('Failed to dispatch targeted push notification to worker:', err);
  }
}

