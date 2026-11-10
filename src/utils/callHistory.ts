import { CallLogRecord } from '../types';
import { getApiUrl } from '../config';

const CALL_HISTORY_STORAGE_KEY = 'quickkarya_call_history_v1';
export const CALL_HISTORY_UPDATED_EVENT = 'quickkarya_call_history_updated';

/**
 * Retrieve all call history logs from persistent local storage
 */
export function getCallHistory(): CallLogRecord[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(CALL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } catch (err) {
    console.warn('Failed to parse call history:', err);
  }
  return [];
}

/**
 * Record a new call or WhatsApp contact attempt into persistent history
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

  try {
    const existing = getCallHistory();
    // Filter out same worker call within the last 5 seconds to prevent rapid double-clicks
    const nowTime = new Date(timestamp).getTime();
    const filtered = existing.filter((item) => {
      const itemTime = new Date(item.timestamp).getTime();
      return !(item.workerPhone === newRecord.workerPhone && Math.abs(nowTime - itemTime) < 5000);
    });

    const updated = [newRecord, ...filtered].slice(0, 50); // Keep 50 most recent calls

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    }

    // Broadcast update event so open views refresh immediately
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(CALL_HISTORY_UPDATED_EVENT, { detail: newRecord }));
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(CALL_HISTORY_UPDATED_EVENT));
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CALL_HISTORY_STORAGE_KEY);
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(CALL_HISTORY_UPDATED_EVENT));
    }

    fetch(getApiUrl('/api/call-logs'), {
      method: 'DELETE'
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to clear call history:', err);
  }
}
