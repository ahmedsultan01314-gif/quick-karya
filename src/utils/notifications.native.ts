import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
      console.warn('Banner listener error:', e);
    }
  });
}

export async function setupNotifications() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH
      })
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('quick-karya-alerts', {
        name: 'Quick Karya Service Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#064e3b',
        sound: 'default'
      });
    }
  } catch (err) {
    console.warn('Native notification setup error:', err);
  }
}

export async function triggerRegistrationNotification(workerName: string, category: string) {
  const title = '🎉 Profile Registered Successfully!';
  const body = `Welcome ${workerName}! Your profile is now live in the Quick Karya ${category} proximity directory.`;

  dispatchInAppBanner(title, body, 'success');

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#064e3b'
      },
      trigger: null
    });
  } catch (e) {
    console.warn('Error scheduling native registration notification:', e);
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

  // Trigger banner event for immediate in-app feedback
  const banner: NotificationBannerData = {
    id: `call-alert-${Date.now()}`,
    title: bannerTitle,
    body: bannerBody,
    type: 'call',
    timestamp: Date.now()
  };
  bannerListeners.forEach((fn) => {
    try {
      fn(banner);
    } catch {
      // ignore
    }
  });

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

