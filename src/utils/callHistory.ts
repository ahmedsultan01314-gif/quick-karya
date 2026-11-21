import { CallLogRecord } from '../types';
import { getApiUrl } from '../config';
import {
  saveCallLogToCloud,
  deleteCallLogFromCloud,
  isMockOrTestProfile,
  isPurgedAccountProfile
} from '../firebase';

const CALL_HISTORY_STORAGE_KEY = 'quickkarya_call_history_v1';
export const CALL_HISTORY_UPDATED_EVENT = 'quickkarya_call_history_updated';

function isCleanCallRecord(r: CallLogRecord | null | undefined): r is CallLogRecord {
  if (!r || !r.id || !r.workerName) return false;
  if (isPurgedAccountProfile({ id: r.workerId, callerId: r.callerId })) return false;
  if (isMockOrTestProfile({ id: r.workerId, name: r.workerName, phone: r.workerPhone })) return false;
  return true;
}

type CallHistoryListener = () => void;
const listeners = new Set<CallHistoryListener>();
let inMemoryCallHistory: CallLogRecord[] = [];

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });

  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function' &&
      typeof CustomEvent === 'function'
    ) {
      window.dispatchEvent(new CustomEvent(CALL_HISTORY_UPDATED_EVENT));
    }
  } catch {
    // Ignore on platforms without DOM CustomEvent
  }
}

export function subscribeCallHistoryUpdates(listener: CallHistoryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Seed in-memory call history (used on native startup after reading AsyncStorage)
 */
export function hydrateCallHistory(records: CallLogRecord[]): CallLogRecord[] {
  if (!Array.isArray(records)) return inMemoryCallHistory;
  try {
    inMemoryCallHistory = [...records]
      .filter(isCleanCallRecord)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
    notifyListeners();
  } catch {
    // ignore
  }
  return inMemoryCallHistory;
}

/**
 * Retrieve all call history logs from persistent local storage or safe native memory cache
 */
export function getCallHistory(): CallLogRecord[] {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(CALL_HISTORY_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const clean = list
            .filter(isCleanCallRecord)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          if (clean.length !== list.length && typeof localStorage.setItem === 'function') {
            localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(clean));
          }
          inMemoryCallHistory = clean;
          return inMemoryCallHistory;
        }
      }
      return [];
    }
  } catch (err) {
    console.warn('Failed to parse call history:', err);
  }
  return inMemoryCallHistory.filter(isCleanCallRecord);
}

/**
 * Record a new call or WhatsApp contact attempt into persistent history (local + Cloud Firestore + API)
 */
export function addCallRecord(
  entry: Omit<CallLogRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): CallLogRecord {
  const timestamp = entry.timestamp || new Date().toISOString();
  const id = entry.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newRecord: CallLogRecord = {
    id,
    workerId: entry.workerId,
    workerName: entry.workerName,
    workerCategory: entry.workerCategory,
    workerPhone: entry.workerPhone,
    workerPhoto: entry.workerPhoto,
    workerCity: entry.workerCity,
    workerRating: entry.workerRating,
    timestamp,
    type: entry.type || entry.callType || 'phone',
    callType: entry.callType || entry.type || 'phone',
    callerId: entry.callerId,
    callerName: entry.callerName,
    callerPhone: entry.callerPhone,
    location: entry.location,
    notes: entry.notes
  };

  if (!isCleanCallRecord(newRecord)) {
    return newRecord;
  }

  try {
    const existing = getCallHistory();
    // Filter out same worker call within the last 5 seconds to prevent rapid double-clicks
    const nowTime = new Date(timestamp).getTime();
    const filtered = existing.filter((item) => {
      const itemTime = new Date(item.timestamp).getTime();
      return !(item.workerPhone === newRecord.workerPhone && Math.abs(nowTime - itemTime) < 5000);
    });

    const updated = [newRecord, ...filtered].slice(0, 50); // Keep 50 most recent calls
    inMemoryCallHistory = updated;

    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    }

    notifyListeners();

    // Sync directly to Cloud Firestore (works natively in APK without needing local server)
    try {
      const cloudRecord: CallLogRecord = { ...newRecord };
      Object.keys(cloudRecord).forEach((k) => {
        if ((cloudRecord as any)[k] === undefined) {
          delete (cloudRecord as any)[k];
        }
      });
      saveCallLogToCloud(cloudRecord).catch(() => {});
    } catch {
      // ignore cloud sync error
    }

    // Asynchronously sync to backend endpoint if available
    fetch(getApiUrl('/api/call-logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord)
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to save call history record:', err);
  }

  return newRecord;
}

/**
 * Remove a specific call record by ID
 */
export function deleteCallRecord(id: string): void {
  try {
    const existing = getCallHistory();
    const updated = existing.filter((item) => item.id !== id);
    inMemoryCallHistory = updated;
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    }
    notifyListeners();

    try {
      deleteCallLogFromCloud(id).catch(() => {});
    } catch {
      // ignore
    }

    fetch(getApiUrl(`/api/call-logs/${id}`), {
      method: 'DELETE'
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to delete call record:', err);
  }
}

/**
 * Clear all call history records
 */
export function clearCallHistory(): void {
  try {
    const existing = getCallHistory();
    inMemoryCallHistory = [];
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(CALL_HISTORY_STORAGE_KEY);
    }
    notifyListeners();

    existing.forEach((item) => {
      try {
        deleteCallLogFromCloud(item.id).catch(() => {});
      } catch {
        // ignore
      }
    });

    fetch(getApiUrl('/api/call-logs'), {
      method: 'DELETE'
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to clear call history:', err);
  }
}
