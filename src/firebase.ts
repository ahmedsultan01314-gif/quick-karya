import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { WorkerProfile } from './types';

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export const WORKERS_COLLECTION = 'workers';

/**
 * Save new worker to Cloud Firestore
 * Enforces isVerified: false by default
 */
export async function saveWorkerToCloud(worker: WorkerProfile): Promise<void> {
  const workerDocRef = doc(db, WORKERS_COLLECTION, worker.id);
  const cleanData: Record<string, any> = {
    id: worker.id,
    name: worker.name,
    category: worker.category,
    experience: worker.experience,
    rating: worker.rating || 5.0,
    reviewCount: worker.reviewCount || 1,
    hourlyRate: 0,
    rate: 0,
    phone: worker.phone,
    city: worker.city,
    state: worker.state || '',
    pincode: worker.pincode,
    latitude: worker.latitude,
    longitude: worker.longitude,
    verified: false,
    isVerified: false,
    available: worker.available ?? true,
    completedJobs: worker.completedJobs ?? 1,
    languages: worker.languages || ['Hindi', 'Local'],
    skills: worker.skills || [worker.category],
    emergencyAvailable: worker.category === 'Emergency Highway Assistance',
    createdAt: new Date().toISOString()
  };

  if (worker.subRole) cleanData.subRole = worker.subRole;
  if (worker.photo) cleanData.photo = worker.photo;
  if (worker.vehicleType) cleanData.vehicleType = worker.vehicleType;

  await setDoc(workerDocRef, cleanData);
}

/**
 * Fetch all workers from Cloud Firestore
 */
export async function fetchWorkersFromCloud(): Promise<WorkerProfile[]> {
  const workersRef = collection(db, WORKERS_COLLECTION);
  const snapshot = await getDocs(workersRef);
  const list: WorkerProfile[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as WorkerProfile;
    list.push({
      ...data,
      id: docSnap.id,
      verified: Boolean(data.isVerified ?? data.verified),
      isVerified: Boolean(data.isVerified ?? data.verified)
    });
  });
  return list;
}

/**
 * Real-time listener for live synchronization across all devices
 */
export function subscribeWorkersFromCloud(
  onUpdate: (workers: WorkerProfile[]) => void,
  onError?: (error: Error) => void
) {
  const workersRef = collection(db, WORKERS_COLLECTION);
  return onSnapshot(
    workersRef,
    (snapshot) => {
      const list: WorkerProfile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as WorkerProfile;
        list.push({
          ...data,
          id: docSnap.id,
          verified: Boolean(data.isVerified ?? data.verified),
          isVerified: Boolean(data.isVerified ?? data.verified)
        });
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}
