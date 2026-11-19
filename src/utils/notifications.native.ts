import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApiUrl } from '../config';
import {
  saveWorkerNotificationToCloud,
  normalizePhone10,
  isGenuinePhone10
} from '../firebase';
import type { WorkerNotification } from '../types';

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
    if (existingStatus !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('quick-karya-alerts', {
        name: 'Quick Karya Service Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFA500',
        sound: 'default'
      });
    }
  } catch (err) {
    console.warn('Native notification setup error:', err);
  }
}

export async function registerForWorkerPushTokenAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId ||
      '2914b087-2f1d-41fa-926f-ffd005769c8c';

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenRes?.data || null;
  } catch (err) {
    console.warn('Expo push token registration skipped cleanly:', err);
    return null;
  }
}

export async function triggerIncomingWorkerLocalNotification(notif: WorkerNotification): Promise<void> {
  dispatchInAppBanner(notif.title, notif.message, 'call');
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notif.title,
        body: notif.message,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#FFA500',
        data: {
          notificationId: notif.id,
          workerId: notif.workerId,
          customerName: notif.customerName,
          customerPhone: notif.customerPhone,
          actionType: notif.actionType
        }
      },
      trigger: null
    });
  } catch (err) {
    console.warn('Could not display local incoming worker notification:', err);
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
        color: '#001F3F'
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
  actionType: 'call' | 'gps_share' = 'call',
  extra?: { workerId?: string; customerId?: string; location?: string }
) {
  const callerName = (customerName || 'Customer').trim() || 'Customer';
  const callerPhone = (customerPhone || '').trim();
  const isGpsShare = actionType === 'gps_share';
  const trade = category || 'Service';

  const workerAlertTitle = '🔔 Quick Karya se kaam aaya!';
  const workerAlertBody = isGpsShare
    ? `Quick Karya se kaam aaya! ${callerName} ne ${trade} kaam ke liye live location pin & request bheji hai.${extra?.location ? ` (${extra.location})` : ''}`
    : `Quick Karya se kaam aaya! ${callerName} (${trade}) aapko kaam ke liye call kar rahe hain.${extra?.location ? ` (${extra.location})` : ''}`;

  const bannerTitle = isGpsShare
    ? 'Quick Karya - GPS & Kaam Alert Bheja Gaya'
    : 'Quick Karya - Call & Kaam Alert Bheja Gaya';
  const bannerBody = `${workerName} ko "${workerAlertTitle}" notification bheja gaya (${callerName}).`;

  // Trigger banner event for immediate customer-side feedback
  dispatchInAppBanner(bannerTitle, bannerBody, 'call');

  const phone10 = normalizePhone10(workerPhone);
  let wroteToFirestore = false;
  if (isGenuinePhone10(phone10)) {
    const notifDoc: WorkerNotification = {
      id: `wn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workerId: extra?.workerId || `w_${phone10}`,
      workerPhone,
      workerPhoneNormalized: phone10,
      workerName,
      workerCategory: trade,
      customerId: extra?.customerId,
      customerName: callerName,
      customerPhone: callerPhone || undefined,
      actionType,
      title: workerAlertTitle,
      message: workerAlertBody,
      location: extra?.location,
      read: false,
      createdAt: new Date().toISOString()
    };
    try {
      await saveWorkerNotificationToCloud(notifDoc);
      wroteToFirestore = true;
    } catch (e) {
      console.warn('Firestore worker notification save error:', e);
    }
  }

  try {
    await fetch(getApiUrl('/api/notifications/notify-worker'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: extra?.workerId,
        workerName,
        workerPhone,
        category: trade,
        customerId: extra?.customerId,
        customerName: callerName,
        customerPhone: callerPhone,
        location: extra?.location,
        actionType,
        skipFirestoreWrite: wroteToFirestore
      })
    });
  } catch (err) {
    console.warn('Failed to dispatch targeted push notification to worker:', err);
  }
}
