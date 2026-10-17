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
  customerPhone?: string
) {
  // CRITICAL: When a customer taps 'Call Worker', do NOT trigger the push notification
  // on the customer's own device. Route the push notification directly to the target
  // Worker's FCM device token.
  const callerName = customerName || 'Customer';
  const callerPhone = customerPhone || '';

  try {
    await fetch(getApiUrl('/api/notifications/notify-worker'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerName,
        workerPhone,
        category,
        customerName: callerName,
        customerPhone: callerPhone
      })
    });
  } catch (err) {
    console.warn('Failed to dispatch targeted push notification to worker:', err);
  }
}

