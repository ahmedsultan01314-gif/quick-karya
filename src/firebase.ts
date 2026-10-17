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
let sessionInfoStore: string | null = null;

export function setupRecaptchaVerifier(containerId: string = 'recaptcha-container'): RecaptchaVerifier | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Running in native environment without DOM
    return null;
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
 * Send SMS OTP directly through Firebase Phone Auth (Web SDK or Firebase Identity Toolkit REST)
 */
export async function sendFirebasePhoneOtp(phoneNumber: string): Promise<{ success: boolean; sessionInfo?: string }> {
  const clean = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
  const formattedPhone = `+91${clean}`;

  // 1. If in browser environment with DOM, try Firebase Web SDK
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const verifier = setupRecaptchaVerifier('recaptcha-container');
      if (verifier) {
        const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        confirmationResultStore = confirmationResult;
        (window as any).firebaseConfirmationResult = confirmationResult;
        return { success: true };
      }
    } catch (webErr: any) {
      console.warn('Firebase Web SDK Phone Auth attempt:', webErr?.code, webErr?.message);
      if (webErr?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Firebase Phone Authentication is not enabled in Firebase Console. Please enable "Phone" under Firebase Console -> Authentication -> Sign-in method for project: ' +
            firebaseConfig.projectId
        );
      }
      if (webErr?.code === 'auth/invalid-phone-number') {
        throw new Error('Invalid mobile number format. Please provide a valid 10-digit mobile number.');
      }
      // If other client error, proceed to try Firebase REST endpoint
    }
  }

  // 2. Call Firebase Identity Toolkit REST API (Works on Android Native and Web with full protocol)
  const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${firebaseConfig.apiKey}`;
  const response = await fetch(restUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: formattedPhone
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errMsg = data?.error?.message || 'Failed to dispatch Firebase SMS OTP';
    if (errMsg.includes('OPERATION_NOT_ALLOWED')) {
      throw new Error(
        'Firebase Phone Authentication is not enabled in project ' +
          firebaseConfig.projectId +
          '. Enable "Phone" under Firebase Console -> Authentication -> Sign-in method.'
      );
    }
    if (errMsg.includes('TOO_MANY_ATTEMPTS_TRY_LATER') || errMsg.includes('QUOTA_EXCEEDED')) {
      throw new Error('Firebase SMS quota exceeded or too many attempts. Please try again later.');
    }
    if (errMsg.includes('INVALID_PHONE_NUMBER')) {
      throw new Error('The phone number provided is invalid.');
    }
    throw new Error(`Firebase Phone Auth: ${errMsg}`);
  }

  if (data?.sessionInfo) {
    sessionInfoStore = data.sessionInfo;
    if (typeof window !== 'undefined') {
      (window as any).firebaseSessionInfo = data.sessionInfo;
    }
  }

  return { success: true, sessionInfo: data?.sessionInfo };
}

/**
 * Verify OTP entered by user through Firebase Phone Auth
 */
export async function verifyFirebasePhoneOtp(
  otpCode: string,
  confirmationResult?: ConfirmationResult
): Promise<{ uid: string; phoneNumber?: string }> {
  // 1. Try Firebase Web SDK confirmationResult if available
  const activeConfirmation =
    confirmationResult || confirmationResultStore || (typeof window !== 'undefined' ? (window as any).firebaseConfirmationResult : null);
  if (activeConfirmation) {
    try {
      const userCredential = await activeConfirmation.confirm(otpCode);
      return {
        uid: userCredential.user.uid,
        phoneNumber: userCredential.user.phoneNumber || undefined
      };
    } catch (confErr: any) {
      console.warn('Firebase confirmationResult error:', confErr?.code, confErr?.message);
      if (confErr?.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid OTP code. Please check and re-enter the 6-digit code.');
      }
      // If other error, check REST session below
    }
  }

  // 2. Try Firebase Identity Toolkit REST signInWithPhoneNumber
  const activeSessionInfo =
    sessionInfoStore || (typeof window !== 'undefined' ? (window as any).firebaseSessionInfo : null);
  if (!activeSessionInfo) {
    throw new Error('No active SMS verification session found. Please request a new verification code.');
  }

  const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${firebaseConfig.apiKey}`;
  const response = await fetch(restUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionInfo: activeSessionInfo,
      code: otpCode.trim()
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errMsg = data?.error?.message || 'Verification failed';
    if (errMsg.includes('INVALID_CODE')) {
      throw new Error('Invalid OTP code. Please enter the correct 6-digit code sent via SMS.');
    }
    if (errMsg.includes('SESSION_EXPIRED')) {
      throw new Error('OTP session has expired. Please request a new verification code.');
    }
    throw new Error(`Firebase Phone Verification: ${errMsg}`);
  }

  return {
    uid: data.localId || `fb_${Date.now()}`,
    phoneNumber: data.phoneNumber
  };
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
