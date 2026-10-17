import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { WorkerProfile, AppUser, WorkerReview, ServiceRequest } from './types';

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export const auth = getAuth(firebaseApp);

/**
 * Firebase Phone Authentication (Native SMS Dispatch without 3rd party API keys)
 */
let confirmationResultStore: ConfirmationResult | null = null;

export function setupRecaptchaVerifier(containerId: string = 'recaptcha-container'): RecaptchaVerifier {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA can only be initialized in a browser environment');
  }

  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch {
      // ignore
    }
    (window as any).recaptchaVerifier = null;
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved automatically
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, please request code again.');
    }
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Send SMS OTP natively through Firebase Phone Auth
 */
export async function sendFirebasePhoneOtp(phoneNumber: string): Promise<ConfirmationResult> {
  const clean = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
  const formattedPhone = `+91${clean}`;

  const verifier = setupRecaptchaVerifier('recaptcha-container');
  const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
  confirmationResultStore = confirmationResult;
  (window as any).firebaseConfirmationResult = confirmationResult;
  return confirmationResult;
}

/**
 * Verify OTP entered by user through Firebase Phone Auth
 */
export async function verifyFirebasePhoneOtp(
  otpCode: string,
  confirmationResult?: ConfirmationResult
): Promise<FirebaseUser> {
  const activeConfirmation =
    confirmationResult || confirmationResultStore || (window as any).firebaseConfirmationResult;
  if (!activeConfirmation) {
    throw new Error('No active SMS verification session found. Please request a new verification code.');
  }

  const userCredential = await activeConfirmation.confirm(otpCode);
  return userCredential.user;
}

export { firebaseSignOut, onAuthStateChanged };
export type { ConfirmationResult, FirebaseUser };

export const WORKERS_COLLECTION = 'workers';
export const USERS_COLLECTION = 'users';
export const REVIEWS_COLLECTION = 'reviews';
export const SERVICE_REQUESTS_COLLECTION = 'serviceRequests';

/**
 * Save worker profile to Cloud Firestore
 */
export async function saveWorkerToCloud(worker: WorkerProfile): Promise<void> {
  const workerDocRef = doc(db, WORKERS_COLLECTION, worker.id);
  const cleanData: Record<string, any> = {
    id: worker.id,
    workerId: worker.workerId || `QK-${Math.floor(10000 + Math.random() * 90000)}`,
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
  const photoVal = worker.photo || worker.avatar || worker.avatarUrl || worker.photoUrl;
  if (photoVal) {
    cleanData.photo = photoVal;
    cleanData.avatar = photoVal;
    cleanData.avatarUrl = photoVal;
  }
  if (worker.vehicleType) cleanData.vehicleType = worker.vehicleType;
  if (worker.fcmToken) cleanData.fcmToken = worker.fcmToken;
  if (worker.pushToken) cleanData.pushToken = worker.pushToken;

  await setDoc(workerDocRef, cleanData);
}

/**
 * Delete worker profile from Cloud Firestore
 */
export async function deleteWorkerFromCloud(workerId: string): Promise<void> {
  const workerDocRef = doc(db, WORKERS_COLLECTION, workerId);
  await deleteDoc(workerDocRef);
}

/**
 * Fetch all workers from Cloud Firestore
 */
export async function fetchWorkersFromCloud(): Promise<WorkerProfile[]> {
  const workersRef = collection(db, WORKERS_COLLECTION);
  const snapshot = await getDocs(workersRef);
  const list: WorkerProfile[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const photo = data.photo || data.avatar || data.avatarUrl || data.photoUrl || data.profileImage || undefined;
    list.push({
      ...data,
      id: docSnap.id,
      workerId: data.workerId || `QK-${data.id?.slice(-5).toUpperCase()}`,
      photo: photo,
      avatar: photo,
      verified: Boolean(data.isVerified ?? data.verified),
      isVerified: Boolean(data.isVerified ?? data.verified),
      fcmToken: data.fcmToken || data.pushToken,
      pushToken: data.pushToken || data.fcmToken
    });
  });
  return list;
}

/**
 * Real-time listener for workers directory
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
        const data = docSnap.data() as any;
        const photo = data.photo || data.avatar || data.avatarUrl || data.photoUrl || data.profileImage || undefined;
        list.push({
          ...data,
          id: docSnap.id,
          workerId: data.workerId || `QK-${data.id?.slice(-5).toUpperCase()}`,
          photo: photo,
          avatar: photo,
          verified: Boolean(data.isVerified ?? data.verified),
          isVerified: Boolean(data.isVerified ?? data.verified),
          fcmToken: data.fcmToken || data.pushToken,
          pushToken: data.pushToken || data.fcmToken
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

/**
 * User Cloud Operations
 */
export async function saveUserToCloud(user: AppUser): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, user.id);
  await setDoc(userRef, user);
}

export async function fetchUserFromCloud(userId: string): Promise<AppUser | null> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as AppUser;
  }
  return null;
}

/**
 * Reviews Cloud Operations
 */
export async function saveReviewToCloud(
  review: WorkerReview
): Promise<{ newRating: number; newCount: number }> {
  const reviewRef = doc(db, REVIEWS_COLLECTION, review.id);
  await setDoc(reviewRef, review);

  // Update worker rating and reviewCount in Firestore
  const workerRef = doc(db, WORKERS_COLLECTION, review.workerId);
  const workerSnap = await getDoc(workerRef);
  let newRating = review.rating;
  let newCount = 1;
  if (workerSnap.exists()) {
    const wData = workerSnap.data() as WorkerProfile;
    const currentCount = wData.reviewCount || 0;
    const currentRating = wData.rating || 5.0;
    newCount = currentCount + 1;
    newRating = Number(((currentRating * currentCount + review.rating) / newCount).toFixed(1));
    await setDoc(workerRef, { rating: newRating, reviewCount: newCount }, { merge: true });
  }
  return { newRating, newCount };
}

export async function fetchReviewsForWorker(workerId: string): Promise<WorkerReview[]> {
  const reviewsRef = collection(db, REVIEWS_COLLECTION);
  const q = query(reviewsRef, where('workerId', '==', workerId));
  const snap = await getDocs(q);
  const list: WorkerReview[] = [];
  snap.forEach((d) => {
    list.push(d.data() as WorkerReview);
  });
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Service Requests Cloud Operations
 */
export async function saveServiceRequestToCloud(req: ServiceRequest): Promise<void> {
  const reqRef = doc(db, SERVICE_REQUESTS_COLLECTION, req.id);
  await setDoc(reqRef, req);
}

export async function fetchUserRequests(userId: string, isWorker: boolean): Promise<ServiceRequest[]> {
  const requestsRef = collection(db, SERVICE_REQUESTS_COLLECTION);
  const field = isWorker ? 'workerId' : 'customerId';
  const q = query(requestsRef, where(field, '==', userId));
  const snap = await getDocs(q);
  const list: ServiceRequest[] = [];
  snap.forEach((d) => {
    list.push(d.data() as ServiceRequest);
  });
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
