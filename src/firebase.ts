import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  deleteDoc,
  query,
  where,
  runTransaction,
  onSnapshot,
  type Firestore
} from 'firebase/firestore';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type Auth
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { WorkerProfile, AppUser, WorkerReview, ServiceRequest, CallLogRecord, WorkerNotification } from './types';
import { getApiUrl } from './config';

// ==========================================
// STRUCTURED FIRESTORE ERROR HANDLING
// ==========================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let firebaseApp: FirebaseApp | null = null;
try {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (err) {
  console.warn('Firebase App initialization failed safely:', err);
  firebaseApp = null;
}

let db: Firestore | null = null;
try {
  if (firebaseApp) {
    db = getFirestore(
      firebaseApp,
      firebaseConfig.firestoreDatabaseId || '(default)'
    );
  }
} catch (err) {
  console.warn('Firestore initialization failed safely:', err);
  db = null;
}

let auth: Auth | null = null;
try {
  if (firebaseApp) {
    auth = getAuth(firebaseApp);
  }
} catch (err) {
  console.warn('Firebase Auth initialization failed safely:', err);
  auth = null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code = (err as any)?.code || '';
  return (
    code === 'permission-denied' ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('PERMISSION_DENIED')
  );
}

// ==========================================
// STRICT PHONE & MOCK/DEMO PROFILE GUARDS
// ==========================================

const BLOCKED_SYNTHETIC_PHONES = new Set<string>([
  '0000000000',
  '1111111111',
  '2222222222',
  '3333333333',
  '4444444444',
  '5555555555',
  '6666666666',
  '7777777777',
  '8888888888',
  '9999999999',
  '1234567890',
  '0123456789',
  '9876543210',
  '0987654321',
  '9123456789',
  '6789012345',
  '9876543211',
  '9988776655',
  '9999988888',
  '9876500000',
  '9999900000',
  '9000000000',
  '8000000000',
  '7000000000',
  '6000000000',
  '8888888880',
  '9898989898',
  '9090909090',
  '7878787878',
  '6969696969'
]);

const BLOCKED_MOCK_DOC_IDS = new Set<string>([
  'mnzmnmfibdtungd6mvfc',
  'demo-worker',
  'test-worker',
  'sample-worker',
  'mock-worker'
]);

const BLOCKED_NAME_PATTERNS: RegExp[] = [
  /\bsantosh\s+sharma\b/i,
  /\bnagan\s+dhar\b/i,
  /\b(demo|test|mock|dummy|sample|placeholder|fake|sandbox)\s*(worker|artisan|user|account|profile|customer|member)?\b/i,
  /\b(john|jane)\s+doe\b/i,
  /\bquick\s*karya\s*member\b/i
];

const BLOCKED_ID_PATTERNS: RegExp[] = [
  /(^|[-_])(demo|test|mock|dummy|sample|fake|sandbox)([-_]|$)/i,
  /^google_native_/i
];

const BLOCKED_EMAIL_PATTERNS: RegExp[] = [
  /^user@quickkarya\.com$/i,
  /^(demo|test|mock|dummy|sample|fake)[.+_-]?.*@/i,
  /@(example\.com|example\.org|example\.net|test\.com|mailinator\.com)$/i
];

export const PURGED_ACCOUNT_EMAILS = new Set<string>([
  'ahmedsultan97009@gmail.com'
]);

export const PURGED_ACCOUNT_IDS = new Set<string>([
  'maKX4mVZhWQD8z1tO4w4RIGzril2'.toLowerCase(),
  'google_ahmedsultan97009_gmail_com',
  'usr_email_ahmedsultan97009_gmail_com',
  'qk-44593',
  'w-local-1792531804413',
  'qk-19355',
  'w-local-1792562755168',
  'qk-52410'
]);

export function isPurgedAccountProfile(profile?: {
  id?: string | null;
  uid?: string | null;
  workerId?: string | null;
  userId?: string | null;
  callerId?: string | null;
  customerId?: string | null;
  email?: string | null;
} | null): boolean {
  if (!profile) return false;
  const emailLower = (profile.email || '').trim().toLowerCase();
  if (emailLower && PURGED_ACCOUNT_EMAILS.has(emailLower)) {
    return true;
  }
  const candidateIds = [
    profile.id,
    profile.uid,
    profile.workerId,
    profile.userId,
    profile.callerId,
    profile.customerId
  ];
  for (const rawId of candidateIds) {
    const cleanId = (rawId || '').trim().toLowerCase();
    if (cleanId && PURGED_ACCOUNT_IDS.has(cleanId)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize a raw phone string to a clean 10-digit Indian mobile number (or '' if malformed).
 */
export function normalizePhone10(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 12 && digits.startsWith('91')) {
    const trimmed = digits.slice(-10);
    return digits.length <= 13 ? trimmed : '';
  }
  return '';
}

/**
 * Validate that a phone number is a genuine 10-digit Indian mobile number (starts with 6-9, not synthetic/repeated/sequential).
 */
export function isGenuinePhone10(phone?: string | null): boolean {
  const phone10 = normalizePhone10(phone);
  if (!/^[6-9]\d{9}$/.test(phone10)) return false;
  if (BLOCKED_SYNTHETIC_PHONES.has(phone10)) return false;
  if (/^(\d)\1{9}$/.test(phone10)) return false;
  if (/(\d)\1{6,}/.test(phone10)) return false;
  if (/^(\d{2})\1{4}$/.test(phone10)) return false;
  return true;
}

/**
 * Detect mock, demo, test, or placeholder profiles by id, workerId, name, email, or phone.
 */
export function isMockOrTestProfile(profile: {
  id?: string | null;
  uid?: string | null;
  workerId?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): boolean {
  if (!profile) return true;

  if (isPurgedAccountProfile(profile)) {
    return true;
  }

  const lowerId = (profile.id || profile.uid || '').trim().toLowerCase();
  const lowerWorkerId = (profile.workerId || '').trim().toLowerCase();
  const cleanName = (profile.name || '').trim();
  const cleanEmail = (profile.email || '').trim().toLowerCase();

  if (lowerId && (BLOCKED_MOCK_DOC_IDS.has(lowerId) || BLOCKED_ID_PATTERNS.some((re) => re.test(lowerId)))) {
    return true;
  }
  if (lowerWorkerId && BLOCKED_ID_PATTERNS.some((re) => re.test(lowerWorkerId))) {
    return true;
  }
  if (cleanName && BLOCKED_NAME_PATTERNS.some((re) => re.test(cleanName))) {
    return true;
  }
  if (cleanEmail && BLOCKED_EMAIL_PATTERNS.some((re) => re.test(cleanEmail))) {
    return true;
  }
  if (profile.phone && !isGenuinePhone10(profile.phone)) {
    return true;
  }

  return false;
}

/**
 * Strict validator for genuine artisan/worker profiles.
 */
export function validateGenuineWorker(worker: Partial<WorkerProfile>): {
  valid: boolean;
  phone10: string;
  reason?: string;
} {
  if (!worker) {
    return { valid: false, phone10: '', reason: 'Worker profile payload is empty.' };
  }

  const cleanName = (worker.name || '').trim();
  if (cleanName.length < 2 || cleanName.length > 100) {
    return { valid: false, phone10: '', reason: 'A valid artisan name (2–100 characters) is required.' };
  }

  if (!worker.category || typeof worker.category !== 'string' || !worker.category.trim()) {
    return { valid: false, phone10: '', reason: 'A valid service category is required.' };
  }

  const phone10 = normalizePhone10(worker.phone);
  if (!isGenuinePhone10(worker.phone)) {
    return {
      valid: false,
      phone10,
      reason: 'A genuine 10-digit Indian mobile number (starting with 6–9) is required. Test or invalid numbers are blocked.'
    };
  }

  if (
    isMockOrTestProfile({
      id: worker.id,
      workerId: worker.workerId,
      name: worker.name,
      phone: worker.phone
    })
  ) {
    return {
      valid: false,
      phone10,
      reason: 'Mock, demo, or test artisan profiles are strictly blocked.'
    };
  }

  return { valid: true, phone10 };
}

function getWorkerCanonicalScore(w: Partial<WorkerProfile>): number {
  let score = 0;
  if (w.isVerified || w.verified) score += 1000;
  if (typeof w.reviewCount === 'number' && w.reviewCount > 0) score += Math.min(w.reviewCount, 50) * 10;
  if (w.photo || w.avatar || w.avatarUrl || w.photoUrl) score += 40;
  if (w.workerId && /^QK-\d+/i.test(w.workerId)) score += 20;
  if (w.id && !w.id.startsWith('w-local-')) score += 10;
  if ((w as any).phoneVerified) score += 15;
  return score;
}

/**
 * Filter out demo / test / invalid-phone accounts and deduplicate workers strictly by 10-digit phone.
 */
export function cleanAndDeduplicateWorkers(rawList: WorkerProfile[]): WorkerProfile[] {
  if (!Array.isArray(rawList)) return [];

  const byPhone = new Map<string, WorkerProfile>();

  for (const w of rawList) {
    if (!w) continue;
    const validation = validateGenuineWorker(w);
    if (!validation.valid) continue;

    const existing = byPhone.get(validation.phone10);
    if (!existing) {
      byPhone.set(validation.phone10, w);
      continue;
    }

    if (getWorkerCanonicalScore(w) > getWorkerCanonicalScore(existing)) {
      byPhone.set(validation.phone10, w);
    }
  }

  return Array.from(byPhone.values());
}

export { firebaseApp, db, auth };

export interface GoogleAuthResult {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
}

export interface AuthUserResult {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
}

/**
 * Robust Google Sign-In with Account Selection
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  if (
    typeof window !== 'undefined' &&
    typeof window.document !== 'undefined' &&
    typeof signInWithPopup === 'function' &&
    auth
  ) {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      return {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Quick Karya User',
        email: user.email || '',
        photoUrl:
          user.photoURL ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'User')}&backgroundColor=001F3F&textColor=FFA500`
      };
    } catch (popupErr: any) {
      console.warn('Firebase signInWithPopup notice:', popupErr?.code, popupErr?.message);
      if (popupErr?.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-In was cancelled.');
      }
      if (popupErr?.code === 'auth/popup-blocked') {
        throw new Error('Sign-in popup was blocked. Please enable popups or use Email & Password.');
      }
      throw popupErr;
    }
  }

  throw new Error('Google Sign-In popup is unavailable in this runtime. Please use Email & Password Sign-In.');
}

/**
 * Sign In with Email & Password
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthUserResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // 1. Attempt client Firebase SDK if supported
  if (auth && typeof signInWithEmailAndPassword === 'function') {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const u = userCredential.user;
      return {
        uid: u.uid,
        name: u.displayName || cleanEmail.split('@')[0],
        email: u.email || cleanEmail,
        photoUrl:
          u.photoURL ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.displayName || cleanEmail)}&backgroundColor=001F3F&textColor=FFA500`
      };
    } catch (firebaseErr: any) {
      console.warn('Firebase client signInWithEmailAndPassword notice:', firebaseErr?.code, firebaseErr?.message);
      if (firebaseErr?.code === 'auth/wrong-password' || firebaseErr?.code === 'auth/invalid-credential') {
        throw new Error('Incorrect email or password.');
      }
    }
  }

  // 2. Verified backend route fallback
  let res: Response;
  try {
    res = await fetch(getApiUrl('/api/auth/login-email'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail, password })
    });
  } catch {
    throw new Error('Could not connect to authentication server. Please check your network.');
  }

  const rawText = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.warn('Backend login non-JSON response:', rawText.slice(0, 120));
    if (!res.ok) {
      throw new Error(`Server returned error code ${res.status}. Please try again.`);
    }
    throw new Error('Authentication response could not be verified. Please try again.');
  }

  if (!res.ok || !data?.user) {
    throw new Error(data?.error || 'Failed to sign in with email and password.');
  }

  const { user } = data;
  return {
    uid: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.profilePhoto || user.avatar
  };
}

/**
 * Register with Email & Password
 */
export async function signUpWithEmail(email: string, password: string, name?: string): Promise<AuthUserResult> {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = (name && name.trim()) || cleanEmail.split('@')[0];
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // 1. Attempt client Firebase SDK
  if (auth && typeof createUserWithEmailAndPassword === 'function') {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const u = userCredential.user;
      if (typeof updateProfile === 'function') {
        await updateProfile(u, { displayName }).catch(() => {});
      }
      return {
        uid: u.uid,
        name: displayName,
        email: u.email || cleanEmail,
        photoUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=001F3F&textColor=FFA500`
      };
    } catch (firebaseErr: any) {
      console.warn('Firebase createUserWithEmailAndPassword notice:', firebaseErr?.code, firebaseErr?.message);
      if (firebaseErr?.code === 'auth/email-already-in-use') {
        throw new Error('An account already exists with this email. Please log in.');
      }
    }
  }

  // 2. Verified backend route fallback
  let res: Response;
  try {
    res = await fetch(getApiUrl('/api/auth/register-email'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail, password, name: displayName })
    });
  } catch {
    throw new Error('Could not connect to authentication server. Please check your network.');
  }

  const rawText = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.warn('Backend register non-JSON response:', rawText.slice(0, 120));
    if (!res.ok) {
      throw new Error(`Server returned error code ${res.status}. Please try again.`);
    }
    throw new Error('Registration response could not be verified. Please try again.');
  }

  if (!res.ok || !data?.user) {
    throw new Error(data?.error || 'Failed to register with email and password.');
  }

  const { user } = data;
  return {
    uid: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.profilePhoto || user.avatar
  };
}

/**
 * Firebase Phone Authentication helpers
 */
let confirmationResultStore: ConfirmationResult | null = null;
let sessionInfoStore: string | null = null;

export function setupRecaptchaVerifier(containerId: string = 'recaptcha-container'): RecaptchaVerifier | null {
  if (!auth || typeof window === 'undefined' || typeof document === 'undefined') {
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
    callback: () => {},
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, please request code again.');
    }
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

export async function sendFirebasePhoneOtp(phoneNumber: string): Promise<{ success: boolean; sessionInfo?: string }> {
  const clean = normalizePhone10(phoneNumber);
  if (!isGenuinePhone10(clean)) {
    throw new Error('Invalid mobile number format. Please provide a genuine 10-digit mobile number.');
  }
  const formattedPhone = `+91${clean}`;

  if (auth && typeof window !== 'undefined' && typeof document !== 'undefined') {
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
    }
  }

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

export async function verifyFirebasePhoneOtp(
  otpCode: string,
  confirmationResult?: ConfirmationResult
): Promise<{ uid: string; phoneNumber?: string }> {
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
    }
  }

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

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn('Firebase Auth signOut notice:', err);
  }
}

export { firebaseSignOut, onAuthStateChanged };
export type { ConfirmationResult, FirebaseUser };

export const WORKERS_COLLECTION = 'workers';
export const PHONE_REGISTRY_COLLECTION = 'phoneRegistry';
export const USERS_COLLECTION = 'users';
export const USER_PHONE_REGISTRY_COLLECTION = 'userPhoneRegistry';
export const REVIEWS_COLLECTION = 'reviews';
export const SERVICE_REQUESTS_COLLECTION = 'serviceRequests';
export const CALL_LOGS_COLLECTION = 'callLogs';
export const WORKER_NOTIFICATIONS_COLLECTION = 'workerNotifications';

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  });
  return clean;
}

// ==========================================
// CONNECTION TEST & STRICT DB CLEANUP ENGINE
// ==========================================

export async function testConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (the client is offline).');
      return false;
    }
    return true;
  }
}

export interface CleanupReport {
  executedAt: string;
  workersScanned: number;
  workersRetained: number;
  deletedMockOrInvalidWorkers: string[];
  deletedDuplicateWorkers: string[];
  usersScanned: number;
  usersRetained: number;
  deletedMockOrInvalidUsers: string[];
  deletedDuplicateUsers: string[];
  deletedOrphanPhoneLocks: string[];
  deletedMockCallLogs: string[];
  deletedMockReviews: string[];
  syncedPhoneLocks: number;
  errors: string[];
}

let activeCleanupPromise: Promise<CleanupReport> | null = null;
let lastCleanupTimestamp = 0;
const CLEANUP_COOLDOWN_MS = 30_000;

function getUserCanonicalScore(u: Record<string, any>): number {
  let score = 0;
  if (u.verified) score += 100;
  if (u.workerId) score += 50;
  if (u.role === 'worker') score += 20;
  if (u.email && !BLOCKED_EMAIL_PATTERNS.some((re) => re.test(String(u.email)))) score += 15;
  if (u.profilePhoto || u.avatar) score += 10;
  if (u.id && !String(u.id).startsWith('usr_')) score += 5;
  return score;
}

/**
 * Purge mock, test, demo, and duplicate entries from browser localStorage safely.
 */
export function purgeLocalStorageArtifacts(extraTarget?: {
  email?: string;
  userId?: string;
  workerId?: string;
}): number {
  let cleanedCount = 0;
  const targetEmail = (extraTarget?.email || '').trim().toLowerCase();
  const targetUserId = (extraTarget?.userId || '').trim();
  const targetWorkerId = (extraTarget?.workerId || '').trim();
  const matchesExtraTarget = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    const objEmail = String(obj.email || '').trim().toLowerCase();
    if (targetEmail && objEmail === targetEmail) return true;
    if (targetUserId && (obj.id === targetUserId || obj.uid === targetUserId || obj.userId === targetUserId || obj.callerId === targetUserId || obj.customerId === targetUserId)) {
      return true;
    }
    if (targetWorkerId && (obj.workerId === targetWorkerId || obj.id === targetWorkerId)) {
      return true;
    }
    return false;
  };

  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return 0;
    }

    // 1. Clean stored user session if mock/test, purged email, or invalid phone
    for (const userKey of ['quick_karya_user', '@quickkarya_user_session_v1']) {
      try {
        const raw = localStorage.getItem(userKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          matchesExtraTarget(parsed) ||
          isPurgedAccountProfile(parsed) ||
          isMockOrTestProfile({
            id: parsed.id,
            workerId: parsed.workerId,
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone
          }) ||
          (parsed.phone && !isGenuinePhone10(parsed.phone))
        ) {
          localStorage.removeItem(userKey);
          cleanedCount += 1;
        }
      } catch {
        localStorage.removeItem(userKey);
        cleanedCount += 1;
      }
    }

    // 2. Clean call history of mock/purged worker logs
    for (const historyKey of ['quickkarya_call_history_v1', '@quickkarya_call_history_v1']) {
      try {
        const rawLogs = localStorage.getItem(historyKey);
        if (rawLogs) {
          const parsedLogs = JSON.parse(rawLogs);
          if (Array.isArray(parsedLogs)) {
            const cleanLogs = parsedLogs.filter(
              (item) =>
                item &&
                !matchesExtraTarget(item) &&
                !isPurgedAccountProfile({
                  id: item.workerId,
                  callerId: item.callerId
                }) &&
                !isMockOrTestProfile({
                  id: item.workerId,
                  name: item.workerName,
                  phone: item.workerPhone
                })
            );
            if (cleanLogs.length !== parsedLogs.length) {
              cleanedCount += parsedLogs.length - cleanLogs.length;
              localStorage.setItem(historyKey, JSON.stringify(cleanLogs));
            }
          }
        }
      } catch {
        // ignore malformed logs
      }
    }

    // 3. Clean saved Google accounts of mock/test/purged/duplicate emails
    try {
      const rawAccs = localStorage.getItem('@quickkarya_saved_google_accounts_v1');
      if (rawAccs) {
        const parsedAccs = JSON.parse(rawAccs);
        if (Array.isArray(parsedAccs)) {
          const seenEmails = new Set<string>();
          const cleanAccs = parsedAccs.filter((acc) => {
            if (!acc || !acc.email || !acc.name) return false;
            const emailLower = String(acc.email).trim().toLowerCase();
            if (
              seenEmails.has(emailLower) ||
              (targetEmail && emailLower === targetEmail) ||
              isPurgedAccountProfile({ id: acc.uid, email: emailLower }) ||
              isMockOrTestProfile({ id: acc.uid, name: acc.name, email: emailLower })
            ) {
              return false;
            }
            seenEmails.add(emailLower);
            return true;
          });
          if (cleanAccs.length !== parsedAccs.length) {
            cleanedCount += parsedAccs.length - cleanAccs.length;
            localStorage.setItem('@quickkarya_saved_google_accounts_v1', JSON.stringify(cleanAccs));
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Clean cached workers lists of mock/purged entries
    for (const workersKey of ['quick_karya_workers', '@quickkarya_workers_v3']) {
      try {
        const rawWorkers = localStorage.getItem(workersKey);
        if (rawWorkers) {
          const parsedWorkers = JSON.parse(rawWorkers);
          if (Array.isArray(parsedWorkers)) {
            const cleanWorkers = parsedWorkers.filter(
              (w) =>
                w &&
                !matchesExtraTarget(w) &&
                !isPurgedAccountProfile(w) &&
                !isMockOrTestProfile({
                  id: w.id,
                  workerId: w.workerId,
                  userId: w.userId,
                  name: w.name,
                  phone: w.phone
                })
            );
            if (cleanWorkers.length !== parsedWorkers.length) {
              cleanedCount += parsedWorkers.length - cleanWorkers.length;
              localStorage.setItem(workersKey, JSON.stringify(cleanWorkers));
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore environments without localStorage
  }
  return cleanedCount;
}

/**
 * Strict Firestore security & cleanup function run on database initialization:
 * - Permanently deletes mock/demo/test artisan entries and invalid/fake phone records
 * - Permanently deletes duplicate phone number entries (keeping 1 canonical genuine profile per unique 10-digit phone)
 * - Syncs unique phone locks in /phoneRegistry/{phone10}
 * - Permanently deletes mock/demo/test user accounts and duplicate phone user accounts
 * - Removes mock/test artifacts in /callLogs, /reviews, and localStorage
 */
export async function enforceFirestoreSecurityAndCleanup(options?: { force?: boolean }): Promise<CleanupReport> {
  purgeLocalStorageArtifacts();
  const emptyReport: CleanupReport = {
    executedAt: new Date().toISOString(),
    workersScanned: 0,
    workersRetained: 0,
    deletedMockOrInvalidWorkers: [],
    deletedDuplicateWorkers: [],
    usersScanned: 0,
    usersRetained: 0,
    deletedMockOrInvalidUsers: [],
    deletedDuplicateUsers: [],
    deletedOrphanPhoneLocks: [],
    deletedMockCallLogs: [],
    deletedMockReviews: [],
    syncedPhoneLocks: 0,
    errors: []
  };

  if (!db) return emptyReport;

  const now = Date.now();
  if (!options?.force && activeCleanupPromise) {
    return activeCleanupPromise;
  }
  if (!options?.force && now - lastCleanupTimestamp < CLEANUP_COOLDOWN_MS) {
    return emptyReport;
  }

  const run = async (): Promise<CleanupReport> => {
    const report: CleanupReport = {
      ...emptyReport,
      executedAt: new Date().toISOString()
    };
    const activeDb = db;
    if (!activeDb) return report;

    const deletedWorkerIds = new Set<string>();
    const survivorByPhone = new Map<string, { id: string; data: Record<string, any> }>();
    const validWorkerIds = new Set<string>();
    let workersScanSucceeded = false;

    // 1. Scan & clean /workers
    try {
      const workersSnap = await getDocs(collection(activeDb, WORKERS_COLLECTION));
      workersScanSucceeded = true;
      report.workersScanned = workersSnap.size;

      const invalidWorkerIds: string[] = [];
      const candidatesByPhone = new Map<string, Array<{ id: string; data: Record<string, any> }>>();

      workersSnap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const candidate: WorkerProfile = {
          ...(data as WorkerProfile),
          id: docSnap.id
        };
        const validation = validateGenuineWorker(candidate);
        if (!validation.valid) {
          invalidWorkerIds.push(docSnap.id);
          return;
        }
        const group = candidatesByPhone.get(validation.phone10) || [];
        group.push({ id: docSnap.id, data });
        candidatesByPhone.set(validation.phone10, group);
      });

      const duplicateWorkerIds: string[] = [];
      for (const [phone10, group] of candidatesByPhone.entries()) {
        group.sort((a, b) => getWorkerCanonicalScore(b.data as WorkerProfile) - getWorkerCanonicalScore(a.data as WorkerProfile));
        const winner = group[0];
        survivorByPhone.set(phone10, winner);
        validWorkerIds.add(winner.id);
        for (let i = 1; i < group.length; i++) {
          duplicateWorkerIds.push(group[i].id);
        }
      }

      // Sync canonical phone locks & phoneNormalized FIRST so security rules allow duplicate deletion
      for (const [phone10, winner] of survivorByPhone.entries()) {
        try {
          const lockRef = doc(activeDb, PHONE_REGISTRY_COLLECTION, phone10);
          await setDoc(
            lockRef,
            stripUndefined({
              phone10,
              workerDocId: winner.id,
              workerId: winner.data.workerId || `QK-${winner.id.slice(-5).toUpperCase()}`,
              updatedAt: new Date().toISOString()
            })
          );
          report.syncedPhoneLocks += 1;

          if (winner.data.phoneNormalized !== phone10) {
            await setDoc(
              doc(activeDb, WORKERS_COLLECTION, winner.id),
              { phoneNormalized: phone10 },
              { merge: true }
            );
          }
        } catch (err: any) {
          report.errors.push(`phoneRegistry/${phone10}: ${err?.message || String(err)}`);
        }
      }

      // Permanently delete invalid/mock workers
      for (const badId of invalidWorkerIds) {
        try {
          await deleteDoc(doc(activeDb, WORKERS_COLLECTION, badId));
          report.deletedMockOrInvalidWorkers.push(badId);
          deletedWorkerIds.add(badId);
        } catch (err: any) {
          report.errors.push(`delete workers/${badId}: ${err?.message || String(err)}`);
        }
      }

      // Permanently delete duplicate-phone workers
      for (const dupId of duplicateWorkerIds) {
        try {
          await deleteDoc(doc(activeDb, WORKERS_COLLECTION, dupId));
          report.deletedDuplicateWorkers.push(dupId);
          deletedWorkerIds.add(dupId);
        } catch (err: any) {
          report.errors.push(`delete dup workers/${dupId}: ${err?.message || String(err)}`);
        }
      }

      report.workersRetained = survivorByPhone.size;
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        report.errors.push(`workers scan permission denied: ${err?.message}`);
      } else {
        report.errors.push(`workers cleanup error: ${err?.message || String(err)}`);
      }
    }

    // 2. Clean orphaned /phoneRegistry locks
    try {
      const regSnap = await getDocs(collection(activeDb, PHONE_REGISTRY_COLLECTION));
      for (const docSnap of regSnap.docs) {
        const phone10 = docSnap.id;
        const data = docSnap.data() as Record<string, any>;
        const survivor = survivorByPhone.get(phone10);
        if (!isGenuinePhone10(phone10) || !survivor || data.workerDocId !== survivor.id) {
          try {
            await deleteDoc(doc(activeDb, PHONE_REGISTRY_COLLECTION, phone10));
            report.deletedOrphanPhoneLocks.push(phone10);
          } catch (err: any) {
            report.errors.push(`delete phoneRegistry/${phone10}: ${err?.message || String(err)}`);
          }
        }
      }
    } catch {
      // phoneRegistry list may be restricted when unauthenticated; non-fatal
    }

    const deletedUserIds = new Set<string>();
    const purgedWorkerIds = new Set<string>();

    // Sign out active Firebase Auth user if it belongs to a permanently purged email/UID
    if (
      auth?.currentUser &&
      isPurgedAccountProfile({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email
      })
    ) {
      await firebaseSignOut(auth).catch(() => {});
    }

    // 3. Scan & clean /users
    try {
      const usersSnap = await getDocs(collection(activeDb, USERS_COLLECTION));
      report.usersScanned = usersSnap.size;

      const invalidUserIds: string[] = [];
      const usersByPhone = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
      let usersWithoutPhoneCount = 0;

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const hasPhone = typeof data.phone === 'string' && data.phone.trim().length > 0;
        const hasEmail = typeof data.email === 'string' && data.email.trim().length > 0;
        const isMock = isMockOrTestProfile({
          id: docSnap.id,
          workerId: data.workerId,
          name: data.name,
          email: data.email,
          phone: hasPhone ? data.phone : undefined
        });

        if (isMock || !data.name || (!hasPhone && !hasEmail)) {
          invalidUserIds.push(docSnap.id);
          deletedUserIds.add(docSnap.id);
          if (data.workerId) purgedWorkerIds.add(String(data.workerId));
          return;
        }

        if (hasPhone) {
          const phone10 = normalizePhone10(data.phone);
          if (!isGenuinePhone10(phone10)) {
            invalidUserIds.push(docSnap.id);
            deletedUserIds.add(docSnap.id);
            return;
          }
          const group = usersByPhone.get(phone10) || [];
          group.push({ id: docSnap.id, data });
          usersByPhone.set(phone10, group);
        } else {
          usersWithoutPhoneCount += 1;
        }
      });

      const duplicateUserIds: string[] = [];
      const survivingUserByPhone = new Map<string, { id: string; data: Record<string, any> }>();
      for (const [phone10, group] of usersByPhone.entries()) {
        group.sort((a, b) => {
          const scoreDiff = getUserCanonicalScore(b.data) - getUserCanonicalScore(a.data);
          if (scoreDiff !== 0) return scoreDiff;
          return String(b.data.createdAt || '').localeCompare(String(a.data.createdAt || ''));
        });
        survivingUserByPhone.set(phone10, group[0]);
        for (let i = 1; i < group.length; i++) {
          duplicateUserIds.push(group[i].id);
          deletedUserIds.add(group[i].id);
        }
      }

      // Sync canonical userPhoneRegistry locks & phoneNormalized FIRST
      for (const [phone10, winner] of survivingUserByPhone.entries()) {
        try {
          await setDoc(doc(activeDb, USER_PHONE_REGISTRY_COLLECTION, phone10), {
            phone10,
            userDocId: winner.id,
            updatedAt: new Date().toISOString()
          });
          if (winner.data.phoneNormalized !== phone10) {
            await setDoc(
              doc(activeDb, USERS_COLLECTION, winner.id),
              { phoneNormalized: phone10 },
              { merge: true }
            );
          }
        } catch (err: any) {
          report.errors.push(`userPhoneRegistry/${phone10}: ${err?.message || String(err)}`);
        }
      }

      for (const badUid of invalidUserIds) {
        try {
          await deleteDoc(doc(activeDb, USERS_COLLECTION, badUid));
          report.deletedMockOrInvalidUsers.push(badUid);
        } catch (err: any) {
          report.errors.push(`delete users/${badUid}: ${err?.message || String(err)}`);
        }
      }

      for (const dupUid of duplicateUserIds) {
        try {
          await deleteDoc(doc(activeDb, USERS_COLLECTION, dupUid));
          report.deletedDuplicateUsers.push(dupUid);
        } catch (err: any) {
          report.errors.push(`delete dup users/${dupUid}: ${err?.message || String(err)}`);
        }
      }

      // Clean orphaned userPhoneRegistry locks
      try {
        const uRegSnap = await getDocs(collection(activeDb, USER_PHONE_REGISTRY_COLLECTION));
        for (const docSnap of uRegSnap.docs) {
          const phone10 = docSnap.id;
          const data = docSnap.data() as Record<string, any>;
          const survivor = survivingUserByPhone.get(phone10);
          if (!isGenuinePhone10(phone10) || !survivor || data.userDocId !== survivor.id) {
            await deleteDoc(doc(activeDb, USER_PHONE_REGISTRY_COLLECTION, phone10)).catch(() => {});
          }
        }
      } catch {
        // non-fatal
      }

      report.usersRetained = usersByPhone.size + usersWithoutPhoneCount;
    } catch (err: any) {
      report.errors.push(`users cleanup notice: ${err?.message || String(err)}`);
    }

    // 4. Clean mock/test/purged/orphaned artifacts in /callLogs, /reviews, /serviceRequests, and /workerNotifications
    try {
      const logsSnap = await getDocs(collection(activeDb, CALL_LOGS_COLLECTION));
      for (const docSnap of logsSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const workerId = String(d.workerId || '');
        const callerId = String(d.callerId || '');
        const isOrphanedWorkerLog =
          workersScanSucceeded &&
          workerId.startsWith('w-') &&
          !validWorkerIds.has(workerId);
        const isMockLog =
          deletedWorkerIds.has(workerId) ||
          purgedWorkerIds.has(workerId) ||
          deletedUserIds.has(callerId) ||
          isPurgedAccountProfile({ id: workerId, callerId }) ||
          isOrphanedWorkerLog ||
          isMockOrTestProfile({
            id: workerId,
            name: d.workerName,
            phone: d.workerPhone
          });
        if (isMockLog) {
          try {
            await deleteDoc(doc(activeDb, CALL_LOGS_COLLECTION, docSnap.id));
            report.deletedMockCallLogs.push(docSnap.id);
          } catch {
            // ignore non-fatal cleanup error
          }
        }
      }
    } catch {
      // callLogs cleanup skipped if unavailable
    }

    try {
      const revSnap = await getDocs(collection(activeDb, REVIEWS_COLLECTION));
      for (const docSnap of revSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const workerId = String(d.workerId || '');
        const customerId = String(d.customerId || '');
        const isOrphanedReview = workersScanSucceeded && !validWorkerIds.has(workerId);
        const isMockRev =
          deletedWorkerIds.has(workerId) ||
          purgedWorkerIds.has(workerId) ||
          deletedUserIds.has(customerId) ||
          isPurgedAccountProfile({ id: workerId, customerId }) ||
          isOrphanedReview ||
          isMockOrTestProfile({
            id: workerId,
            name: d.customerName
          });
        if (isMockRev) {
          try {
            await deleteDoc(doc(activeDb, REVIEWS_COLLECTION, docSnap.id));
            report.deletedMockReviews.push(docSnap.id);
          } catch {
            // ignore non-fatal cleanup error
          }
        }
      }
    } catch {
      // reviews cleanup skipped if unavailable
    }

    try {
      const reqSnap = await getDocs(collection(activeDb, SERVICE_REQUESTS_COLLECTION));
      for (const docSnap of reqSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const customerId = String(d.customerId || '');
        const workerId = String(d.workerId || '');
        if (
          deletedUserIds.has(customerId) ||
          deletedWorkerIds.has(workerId) ||
          purgedWorkerIds.has(workerId) ||
          isPurgedAccountProfile({ id: workerId, customerId })
        ) {
          await deleteDoc(doc(activeDb, SERVICE_REQUESTS_COLLECTION, docSnap.id)).catch(() => {});
        }
      }
    } catch {
      // serviceRequests cleanup skipped if unavailable
    }

    try {
      const notifSnap = await getDocs(collection(activeDb, WORKER_NOTIFICATIONS_COLLECTION));
      for (const docSnap of notifSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const workerId = String(d.workerId || '');
        const customerId = String(d.customerId || '');
        if (
          deletedWorkerIds.has(workerId) ||
          purgedWorkerIds.has(workerId) ||
          deletedUserIds.has(customerId) ||
          isPurgedAccountProfile({ id: workerId, customerId }) ||
          isMockOrTestProfile({
            id: workerId,
            name: d.workerName,
            phone: d.workerPhone
          }) ||
          isMockOrTestProfile({
            name: d.customerName
          })
        ) {
          await deleteDoc(doc(activeDb, WORKER_NOTIFICATIONS_COLLECTION, docSnap.id)).catch(() => {});
        }
      }
    } catch {
      // workerNotifications cleanup skipped if unavailable
    }

    lastCleanupTimestamp = Date.now();
    return report;
  };

  activeCleanupPromise = run().finally(() => {
    activeCleanupPromise = null;
  });

  return activeCleanupPromise;
}

/**
 * Automatically run connection check & database integrity cleanup on DB initialization.
 */
export function initializeDatabaseSecurity(): void {
  if (!db) return;
  testConnection()
    .then((connected) => {
      if (connected) {
        return enforceFirestoreSecurityAndCleanup();
      }
      return undefined;
    })
    .then((report) => {
      if (!report) return;
      const totalDeleted =
        report.deletedMockOrInvalidWorkers.length +
        report.deletedDuplicateWorkers.length +
        report.deletedMockOrInvalidUsers.length +
        report.deletedDuplicateUsers.length +
        report.deletedMockCallLogs.length +
        report.deletedMockReviews.length;
      if (totalDeleted > 0) {
        console.info(
          `[Quick Karya Firestore Security] Cleaned ${totalDeleted} invalid/mock/duplicate record(s). Retained ${report.workersRetained} unique genuine worker(s).`
        );
      }
    })
    .catch((err) => {
      console.warn('Database initialization cleanup skipped safely:', err?.message || err);
    });
}

initializeDatabaseSecurity();

/**
 * Save worker profile to Cloud Firestore with strict validation & duplicate phone blocking
 */
export async function saveWorkerToCloud(worker: WorkerProfile): Promise<void> {
  if (!db) return;

  const validation = validateGenuineWorker(worker);
  if (!validation.valid) {
    throw new Error(
      validation.reason ||
        'Blocked: Only genuine artisan profiles with a valid 10-digit mobile number can be registered.'
    );
  }

  const phone10 = validation.phone10;
  const normalizedWorkerId = worker.workerId || `QK-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Scan for any existing worker sharing the same 10-digit phone under a different document ID
  const duplicateQuery = query(
    collection(db, WORKERS_COLLECTION),
    where('phoneNormalized', '==', phone10)
  );
  let dupSnap;
  try {
    dupSnap = await getDocs(duplicateQuery);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.LIST, WORKERS_COLLECTION);
    }
    throw err;
  }

  for (const existingDoc of dupSnap.docs) {
    if (existingDoc.id !== worker.id) {
      throw new Error(
        `Duplicate phone number blocked: +91 ${phone10} is already registered to another Quick Karya artisan.`
      );
    }
  }

  // Fallback full-collection check for legacy documents without phoneNormalized
  try {
    const allSnap = await getDocs(collection(db, WORKERS_COLLECTION));
    for (const existingDoc of allSnap.docs) {
      if (existingDoc.id !== worker.id) {
        const existingPhone10 = normalizePhone10((existingDoc.data() as any)?.phone);
        if (existingPhone10 && existingPhone10 === phone10) {
          throw new Error(
            `Duplicate phone number blocked: +91 ${phone10} is already registered to another Quick Karya artisan.`
          );
        }
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('Duplicate phone number blocked')) {
      throw err;
    }
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.LIST, WORKERS_COLLECTION);
    }
  }

  const workerDocRef = doc(db, WORKERS_COLLECTION, worker.id);
  const phoneRegistryRef = doc(db, PHONE_REGISTRY_COLLECTION, phone10);

  const cleanData: Record<string, any> = {
    id: worker.id,
    workerId: normalizedWorkerId,
    name: worker.name.trim(),
    category: worker.category,
    experience: worker.experience,
    rating: worker.rating || 5.0,
    reviewCount: worker.reviewCount ?? 0,
    hourlyRate: 0,
    rate: 0,
    phone: worker.phone,
    phoneNormalized: phone10,
    city: worker.city,
    state: worker.state || '',
    pincode: worker.pincode,
    latitude: worker.latitude,
    longitude: worker.longitude,
    verified: Boolean(worker.verified),
    isVerified: Boolean(worker.isVerified ?? worker.verified),
    available: worker.available ?? true,
    completedJobs: worker.completedJobs ?? 0,
    languages: worker.languages || ['Hindi', 'Local'],
    skills: worker.skills || [worker.category],
    emergencyAvailable: worker.category === 'Emergency Highway Assistance',
    createdAt: (worker as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
  if ((worker as any).userId) cleanData.userId = (worker as any).userId;

  try {
    await runTransaction(db, async (tx) => {
      const regSnap = await tx.get(phoneRegistryRef);
      if (regSnap.exists()) {
        const regData = regSnap.data() as Record<string, any>;
        if (regData.workerDocId && regData.workerDocId !== worker.id) {
          const ownerSnap = await tx.get(doc(db!, WORKERS_COLLECTION, regData.workerDocId));
          if (ownerSnap.exists()) {
            throw new Error(
              `Duplicate phone number blocked: +91 ${phone10} is already locked to another artisan profile.`
            );
          }
        }
      }

      tx.set(phoneRegistryRef, {
        phone10,
        workerDocId: worker.id,
        workerId: normalizedWorkerId,
        updatedAt: new Date().toISOString()
      });

      tx.set(workerDocRef, stripUndefined(cleanData));
    });
  } catch (err: any) {
    if (err?.message?.includes('Duplicate phone number blocked')) {
      throw err;
    }
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${WORKERS_COLLECTION}/${worker.id}`);
    }
    console.warn('Could not save worker to Cloud Firestore:', err);
    throw err;
  }
}

/**
 * Delete worker profile from Cloud Firestore (and release its phoneRegistry lock if owned by it)
 */
export async function deleteWorkerFromCloud(workerId: string): Promise<void> {
  if (!db) return;
  try {
    const workerDocRef = doc(db, WORKERS_COLLECTION, workerId);
    const snap = await getDoc(workerDocRef);
    const phone10 = snap.exists() ? normalizePhone10((snap.data() as any)?.phone) : '';

    await deleteDoc(workerDocRef);

    if (phone10) {
      const regRef = doc(db, PHONE_REGISTRY_COLLECTION, phone10);
      const regSnap = await getDoc(regRef);
      if (regSnap.exists() && regSnap.data()?.workerDocId === workerId) {
        await deleteDoc(regRef).catch(() => {});
      }
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.DELETE, `${WORKERS_COLLECTION}/${workerId}`);
    }
    console.warn('Could not delete worker from Cloud Firestore:', err);
  }
}

/**
 * Fetch all workers from Cloud Firestore (strictly cleaned & deduplicated)
 */
export async function fetchWorkersFromCloud(): Promise<WorkerProfile[]> {
  if (!db) return [];
  try {
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
        photo,
        avatar: photo,
        verified: Boolean(data.isVerified ?? data.verified),
        isVerified: Boolean(data.isVerified ?? data.verified),
        fcmToken: data.fcmToken || data.pushToken,
        pushToken: data.pushToken || data.fcmToken
      });
    });
    return cleanAndDeduplicateWorkers(list);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.LIST, WORKERS_COLLECTION);
    }
    console.warn('Could not fetch workers from Cloud Firestore:', err);
    return [];
  }
}

/**
 * Real-time listener for workers directory (strictly cleaned & deduplicated)
 */
export function subscribeWorkersFromCloud(
  onUpdate: (workers: WorkerProfile[]) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    if (onError) onError(new Error('Cloud Firestore is unavailable'));
    return () => {};
  }
  try {
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
            photo,
            avatar: photo,
            verified: Boolean(data.isVerified ?? data.verified),
            isVerified: Boolean(data.isVerified ?? data.verified),
            fcmToken: data.fcmToken || data.pushToken,
            pushToken: data.pushToken || data.fcmToken
          });
        });
        onUpdate(cleanAndDeduplicateWorkers(list));
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          try {
            handleFirestoreError(err, OperationType.LIST, WORKERS_COLLECTION);
          } catch (wrappedErr: any) {
            if (onError) onError(wrappedErr);
            return;
          }
        }
        console.warn('Firestore subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Firestore subscription setup error:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Call Logs Cloud Operations
 */
export async function saveCallLogToCloud(callLog: CallLogRecord): Promise<void> {
  if (!db) return;
  if (
    isMockOrTestProfile({
      id: callLog.workerId,
      name: callLog.workerName,
      phone: callLog.workerPhone
    })
  ) {
    return;
  }
  try {
    const logRef = doc(db, CALL_LOGS_COLLECTION, callLog.id);
    await setDoc(logRef, stripUndefined(callLog));
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${CALL_LOGS_COLLECTION}/${callLog.id}`);
    }
    console.warn('Could not save call log to Cloud Firestore:', err);
  }
}

export async function deleteCallLogFromCloud(callLogId: string): Promise<void> {
  if (!db) return;
  try {
    const logRef = doc(db, CALL_LOGS_COLLECTION, callLogId);
    await deleteDoc(logRef);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.DELETE, `${CALL_LOGS_COLLECTION}/${callLogId}`);
    }
    console.warn('Could not delete call log from Cloud Firestore:', err);
  }
}

/**
 * User Cloud Operations (blocks mock/test users and duplicate phone numbers)
 */
export async function saveUserToCloud(user: AppUser): Promise<void> {
  if (!db) return;

  const hasPhone = typeof user.phone === 'string' && user.phone.trim().length > 0;
  if (
    isMockOrTestProfile({
      id: user.id,
      workerId: user.workerId,
      name: user.name,
      email: user.email,
      phone: hasPhone ? user.phone : undefined
    })
  ) {
    throw new Error('Blocked: Mock, demo, or invalid user profiles cannot be saved to Firestore.');
  }

  let phone10 = '';
  if (hasPhone) {
    phone10 = normalizePhone10(user.phone);
    if (!isGenuinePhone10(phone10)) {
      throw new Error('Blocked: User phone number must be a genuine 10-digit Indian mobile number.');
    }

    // Check for duplicate phone across existing users
    const dupUsersSnap = await getDocs(
      query(collection(db, USERS_COLLECTION), where('phoneNormalized', '==', phone10))
    );
    for (const docSnap of dupUsersSnap.docs) {
      if (docSnap.id !== user.id) {
        throw new Error(
          `Duplicate phone number blocked: +91 ${phone10} is already registered to another Quick Karya user.`
        );
      }
    }
  }

  try {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    const payload: Record<string, any> = stripUndefined({
      ...user,
      ...(phone10 ? { phoneNormalized: phone10 } : {}),
      updatedAt: new Date().toISOString()
    });

    if (phone10) {
      const userPhoneRegRef = doc(db, USER_PHONE_REGISTRY_COLLECTION, phone10);
      await runTransaction(db, async (tx) => {
        const regSnap = await tx.get(userPhoneRegRef);
        if (regSnap.exists()) {
          const regData = regSnap.data() as Record<string, any>;
          if (regData.userDocId && regData.userDocId !== user.id) {
            const ownerSnap = await tx.get(doc(db!, USERS_COLLECTION, regData.userDocId));
            if (ownerSnap.exists()) {
              throw new Error(
                `Duplicate phone number blocked: +91 ${phone10} is already registered to another Quick Karya user.`
              );
            }
          }
        }
        tx.set(userPhoneRegRef, {
          phone10,
          userDocId: user.id,
          updatedAt: new Date().toISOString()
        });
        tx.set(userRef, payload, { merge: true });
      });
    } else {
      await setDoc(userRef, payload, { merge: true });
    }
  } catch (err: any) {
    if (err?.message?.includes('Duplicate phone number blocked')) {
      throw err;
    }
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${USERS_COLLECTION}/${user.id}`);
    }
    console.warn('Could not save user to Cloud Firestore:', err);
    throw err;
  }
}

export async function fetchUserFromCloud(userId: string): Promise<AppUser | null> {
  if (!db) return null;
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as AppUser;
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.GET, `${USERS_COLLECTION}/${userId}`);
    }
    console.warn('Could not fetch user from Cloud Firestore:', err);
  }
  return null;
}

export async function fetchGoogleAccountsFromCloud(): Promise<
  Array<{ uid: string; name: string; email: string; photoUrl?: string }>
> {
  if (!db) return [];
  try {
    const q = query(collection(db, USERS_COLLECTION), where('authProvider', '==', 'google'));
    const snap = await getDocs(q);
    const seenEmails = new Set<string>();
    const results: Array<{ uid: string; name: string; email: string; photoUrl?: string }> = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!email || !name) return;
      if (
        isMockOrTestProfile({
          id: docSnap.id,
          workerId: data.workerId,
          name,
          email,
          phone: data.phone
        })
      ) {
        return;
      }
      if (seenEmails.has(email)) return;
      seenEmails.add(email);
      results.push({
        uid: data.id || docSnap.id,
        name,
        email,
        photoUrl: data.profilePhoto || data.avatar || undefined
      });
    });
    return results;
  } catch {
    return [];
  }
}

export interface AccountDeletionReport {
  executedAt: string;
  target: {
    email?: string;
    userId?: string;
    workerId?: string;
    phone?: string;
  };
  deletedUserIds: string[];
  deletedWorkerIds: string[];
  deletedCallLogIds: string[];
  deletedReviewIds: string[];
  deletedServiceRequestIds: string[];
  deletedNotificationIds: string[];
  releasedPhoneLocks: string[];
  localItemsCleaned: number;
  signedOutAuth: boolean;
  errors: string[];
}

/**
 * Reusable Account & Associated Data Deletion Utility:
 * Permanently removes a user account (matched by email, userId, workerId, or phone)
 * along with linked worker profiles, call logs, reviews, service requests,
 * worker notifications, phone registry locks, and local cached session artifacts.
 */
export async function deleteAccountAndAssociatedData(target: {
  email?: string;
  userId?: string;
  workerId?: string;
  phone?: string;
}): Promise<AccountDeletionReport> {
  const cleanEmail = (target.email || '').trim().toLowerCase();
  const cleanUserId = (target.userId || '').trim();
  const cleanWorkerId = (target.workerId || '').trim();
  const cleanPhone10 = normalizePhone10(target.phone);

  const report: AccountDeletionReport = {
    executedAt: new Date().toISOString(),
    target: {
      ...(cleanEmail ? { email: cleanEmail } : {}),
      ...(cleanUserId ? { userId: cleanUserId } : {}),
      ...(cleanWorkerId ? { workerId: cleanWorkerId } : {}),
      ...(cleanPhone10 ? { phone: cleanPhone10 } : {})
    },
    deletedUserIds: [],
    deletedWorkerIds: [],
    deletedCallLogIds: [],
    deletedReviewIds: [],
    deletedServiceRequestIds: [],
    deletedNotificationIds: [],
    releasedPhoneLocks: [],
    localItemsCleaned: 0,
    signedOutAuth: false,
    errors: []
  };

  const matchedUserIds = new Set<string>(cleanUserId ? [cleanUserId] : []);
  const matchedWorkerIds = new Set<string>(cleanWorkerId ? [cleanWorkerId] : []);
  const matchedPhones10 = new Set<string>(cleanPhone10 ? [cleanPhone10] : []);

  if (db) {
    const activeDb = db;

    // 1. Find & delete matching /users records
    try {
      const usersSnap = await getDocs(collection(activeDb, USERS_COLLECTION));
      for (const docSnap of usersSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const docEmail = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
        const docPhone10 = normalizePhone10(d.phoneNormalized || d.phone);
        const matches =
          (cleanEmail && docEmail === cleanEmail) ||
          (cleanUserId && (docSnap.id === cleanUserId || d.id === cleanUserId)) ||
          (cleanWorkerId && d.workerId === cleanWorkerId) ||
          (cleanPhone10 && docPhone10 === cleanPhone10);

        if (matches) {
          matchedUserIds.add(docSnap.id);
          if (d.id) matchedUserIds.add(String(d.id));
          if (d.workerId) matchedWorkerIds.add(String(d.workerId));
          if (isGenuinePhone10(docPhone10)) matchedPhones10.add(docPhone10);

          try {
            await deleteDoc(doc(activeDb, USERS_COLLECTION, docSnap.id));
            report.deletedUserIds.push(docSnap.id);
          } catch (err: any) {
            report.errors.push(`delete users/${docSnap.id}: ${err?.message || String(err)}`);
          }
        }
      }
    } catch (err: any) {
      report.errors.push(`scan users error: ${err?.message || String(err)}`);
    }

    // 2. Clean matching /userPhoneRegistry locks
    for (const phone10 of matchedPhones10) {
      if (!isGenuinePhone10(phone10)) continue;
      try {
        const regRef = doc(activeDb, USER_PHONE_REGISTRY_COLLECTION, phone10);
        const regSnap = await getDoc(regRef);
        if (regSnap.exists()) {
          const ownerId = String(regSnap.data()?.userDocId || '');
          if (!ownerId || matchedUserIds.has(ownerId)) {
            await deleteDoc(regRef);
            report.releasedPhoneLocks.push(`userPhoneRegistry/${phone10}`);
          }
        }
      } catch (err: any) {
        report.errors.push(`userPhoneRegistry/${phone10}: ${err?.message || String(err)}`);
      }
    }

    // 3. Find & delete matching /workers records
    try {
      const workersSnap = await getDocs(collection(activeDb, WORKERS_COLLECTION));
      for (const docSnap of workersSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const docPhone10 = normalizePhone10(d.phoneNormalized || d.phone);
        const docUserId = String(d.userId || '');
        const docWorkerCode = String(d.workerId || '');
        const matches =
          matchedWorkerIds.has(docSnap.id) ||
          (docWorkerCode && matchedWorkerIds.has(docWorkerCode)) ||
          (docUserId && matchedUserIds.has(docUserId)) ||
          (docPhone10 && matchedPhones10.has(docPhone10));

        if (matches) {
          matchedWorkerIds.add(docSnap.id);
          if (docWorkerCode) matchedWorkerIds.add(docWorkerCode);
          if (isGenuinePhone10(docPhone10)) matchedPhones10.add(docPhone10);

          try {
            await deleteDoc(doc(activeDb, WORKERS_COLLECTION, docSnap.id));
            report.deletedWorkerIds.push(docSnap.id);
          } catch (err: any) {
            report.errors.push(`delete workers/${docSnap.id}: ${err?.message || String(err)}`);
          }
        }
      }
    } catch (err: any) {
      report.errors.push(`scan workers error: ${err?.message || String(err)}`);
    }

    // 4. Clean matching /phoneRegistry locks
    for (const phone10 of matchedPhones10) {
      if (!isGenuinePhone10(phone10)) continue;
      try {
        const regRef = doc(activeDb, PHONE_REGISTRY_COLLECTION, phone10);
        const regSnap = await getDoc(regRef);
        if (regSnap.exists()) {
          const ownerDocId = String(regSnap.data()?.workerDocId || '');
          if (!ownerDocId || matchedWorkerIds.has(ownerDocId)) {
            await deleteDoc(regRef);
            report.releasedPhoneLocks.push(`phoneRegistry/${phone10}`);
          }
        }
      } catch (err: any) {
        report.errors.push(`phoneRegistry/${phone10}: ${err?.message || String(err)}`);
      }
    }

    // 5. Delete associated /callLogs
    try {
      const logsSnap = await getDocs(collection(activeDb, CALL_LOGS_COLLECTION));
      for (const docSnap of logsSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const callerId = String(d.callerId || '');
        const wId = String(d.workerId || '');
        if ((callerId && matchedUserIds.has(callerId)) || (wId && matchedWorkerIds.has(wId))) {
          await deleteDoc(doc(activeDb, CALL_LOGS_COLLECTION, docSnap.id))
            .then(() => report.deletedCallLogIds.push(docSnap.id))
            .catch((err: any) => report.errors.push(`delete callLogs/${docSnap.id}: ${err?.message || err}`));
        }
      }
    } catch (err: any) {
      report.errors.push(`scan callLogs error: ${err?.message || String(err)}`);
    }

    // 6. Delete associated /reviews
    try {
      const revSnap = await getDocs(collection(activeDb, REVIEWS_COLLECTION));
      for (const docSnap of revSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const customerId = String(d.customerId || '');
        const wId = String(d.workerId || '');
        if ((customerId && matchedUserIds.has(customerId)) || (wId && matchedWorkerIds.has(wId))) {
          await deleteDoc(doc(activeDb, REVIEWS_COLLECTION, docSnap.id))
            .then(() => report.deletedReviewIds.push(docSnap.id))
            .catch((err: any) => report.errors.push(`delete reviews/${docSnap.id}: ${err?.message || err}`));
        }
      }
    } catch (err: any) {
      report.errors.push(`scan reviews error: ${err?.message || String(err)}`);
    }

    // 7. Delete associated /serviceRequests
    try {
      const reqSnap = await getDocs(collection(activeDb, SERVICE_REQUESTS_COLLECTION));
      for (const docSnap of reqSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const customerId = String(d.customerId || '');
        const wId = String(d.workerId || '');
        if ((customerId && matchedUserIds.has(customerId)) || (wId && matchedWorkerIds.has(wId))) {
          await deleteDoc(doc(activeDb, SERVICE_REQUESTS_COLLECTION, docSnap.id))
            .then(() => report.deletedServiceRequestIds.push(docSnap.id))
            .catch((err: any) => report.errors.push(`delete serviceRequests/${docSnap.id}: ${err?.message || err}`));
        }
      }
    } catch (err: any) {
      report.errors.push(`scan serviceRequests error: ${err?.message || String(err)}`);
    }

    // 8. Delete associated /workerNotifications
    try {
      const notifSnap = await getDocs(collection(activeDb, WORKER_NOTIFICATIONS_COLLECTION));
      for (const docSnap of notifSnap.docs) {
        const d = docSnap.data() as Record<string, any>;
        const customerId = String(d.customerId || '');
        const wId = String(d.workerId || '');
        if ((customerId && matchedUserIds.has(customerId)) || (wId && matchedWorkerIds.has(wId))) {
          await deleteDoc(doc(activeDb, WORKER_NOTIFICATIONS_COLLECTION, docSnap.id))
            .then(() => report.deletedNotificationIds.push(docSnap.id))
            .catch((err: any) => report.errors.push(`delete workerNotifications/${docSnap.id}: ${err?.message || err}`));
        }
      }
    } catch (err: any) {
      report.errors.push(`scan workerNotifications error: ${err?.message || String(err)}`);
    }
  }

  // 9. Clean local storage cache entries matching target or purged accounts
  report.localItemsCleaned = purgeLocalStorageArtifacts({
    email: cleanEmail || undefined,
    userId: cleanUserId || undefined,
    workerId: cleanWorkerId || undefined
  });

  // 10. Clear Firebase Auth persisted user if matching
  if (auth?.currentUser) {
    const authEmail = (auth.currentUser.email || '').trim().toLowerCase();
    const authUid = auth.currentUser.uid;
    if (
      (cleanEmail && authEmail === cleanEmail) ||
      (cleanUserId && authUid === cleanUserId) ||
      matchedUserIds.has(authUid) ||
      isPurgedAccountProfile({ uid: authUid, email: authEmail })
    ) {
      try {
        await auth.currentUser.delete().catch(async () => {
          await firebaseSignOut(auth!);
        });
        await firebaseSignOut(auth).catch(() => {});
        report.signedOutAuth = true;
      } catch {
        report.signedOutAuth = true;
      }
    }
  }

  return report;
}

/**
 * Reviews Cloud Operations
 */
export async function saveReviewToCloud(
  review: WorkerReview
): Promise<{ newRating: number; newCount: number }> {
  if (!db) {
    return { newRating: review.rating, newCount: 1 };
  }
  try {
    const reviewRef = doc(db, REVIEWS_COLLECTION, review.id);
    await setDoc(reviewRef, stripUndefined(review));

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
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${REVIEWS_COLLECTION}/${review.id}`);
    }
    throw err;
  }
}

export async function fetchReviewsForWorker(workerId: string): Promise<WorkerReview[]> {
  if (!db) return [];
  try {
    const reviewsRef = collection(db, REVIEWS_COLLECTION);
    const q = query(reviewsRef, where('workerId', '==', workerId));
    const snap = await getDocs(q);
    const list: WorkerReview[] = [];
    snap.forEach((d) => {
      list.push(d.data() as WorkerReview);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.LIST, REVIEWS_COLLECTION);
    }
    console.warn('Could not fetch reviews from Cloud Firestore:', err);
    return [];
  }
}

/**
 * Service Requests Cloud Operations
 */
export async function saveServiceRequestToCloud(req: ServiceRequest): Promise<void> {
  if (!db) return;
  try {
    const reqRef = doc(db, SERVICE_REQUESTS_COLLECTION, req.id);
    await setDoc(reqRef, stripUndefined(req));
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${SERVICE_REQUESTS_COLLECTION}/${req.id}`);
    }
    console.warn('Could not save service request to Cloud Firestore:', err);
  }
}

export async function fetchUserRequests(userId: string, isWorker: boolean): Promise<ServiceRequest[]> {
  if (!db) return [];
  try {
    const requestsRef = collection(db, SERVICE_REQUESTS_COLLECTION);
    const field = isWorker ? 'workerId' : 'customerId';
    const q = query(requestsRef, where(field, '==', userId));
    const snap = await getDocs(q);
    const list: ServiceRequest[] = [];
    snap.forEach((d) => {
      list.push(d.data() as ServiceRequest);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.LIST, SERVICE_REQUESTS_COLLECTION);
    }
    console.warn('Could not fetch user requests from Cloud Firestore:', err);
    return [];
  }
}

/**
 * Worker Notifications ("Quick Karya se kaam aaya!")
 */
export async function saveWorkerNotificationToCloud(notif: WorkerNotification): Promise<void> {
  if (!db) return;
  const phone10 = normalizePhone10(notif.workerPhoneNormalized || notif.workerPhone);
  if (!isGenuinePhone10(phone10)) return;
  if (
    isMockOrTestProfile({ id: notif.workerId, name: notif.workerName, phone: phone10 }) ||
    isMockOrTestProfile({ name: notif.customerName })
  ) {
    return;
  }

  try {
    const cleanPayload: WorkerNotification = {
      id: notif.id,
      workerId: notif.workerId || `w_${phone10}`,
      workerPhone: notif.workerPhone,
      workerPhoneNormalized: phone10,
      workerName: notif.workerName.trim().slice(0, 100),
      workerCategory: notif.workerCategory ? notif.workerCategory.slice(0, 64) : undefined,
      customerId: notif.customerId ? notif.customerId.slice(0, 128) : undefined,
      customerName: (notif.customerName || 'Customer').trim().slice(0, 100),
      customerPhone: notif.customerPhone ? notif.customerPhone.slice(0, 24) : undefined,
      actionType: notif.actionType,
      title: notif.title.slice(0, 140),
      message: notif.message.slice(0, 500),
      location: notif.location ? notif.location.slice(0, 256) : undefined,
      read: false,
      createdAt: notif.createdAt || new Date().toISOString()
    };

    await setDoc(doc(db, WORKER_NOTIFICATIONS_COLLECTION, notif.id), stripUndefined(cleanPayload));
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${WORKER_NOTIFICATIONS_COLLECTION}/${notif.id}`);
    }
    console.warn('Could not save worker notification to Firestore:', err);
  }
}

export function subscribeWorkerNotificationsFromCloud(
  workerPhone: string | undefined,
  workerId: string | undefined,
  onUpdate: (notifications: WorkerNotification[]) => void
) {
  const phone10 = normalizePhone10(workerPhone);
  if (!db || (!isGenuinePhone10(phone10) && !workerId)) {
    onUpdate([]);
    return () => {};
  }

  try {
    const notifRef = collection(db, WORKER_NOTIFICATIONS_COLLECTION);
    const q = isGenuinePhone10(phone10)
      ? query(notifRef, where('workerPhoneNormalized', '==', phone10))
      : query(notifRef, where('workerId', '==', workerId!));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: WorkerNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as WorkerNotification;
          if (data && data.title && data.message) {
            list.push({ ...data, id: docSnap.id });
          }
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(list.slice(0, 30));
      },
      (err) => {
        console.warn('Worker notifications subscription error:', err);
      }
    );
  } catch (err) {
    console.warn('Worker notifications listener init error:', err);
    return () => {};
  }
}

export async function markWorkerNotificationReadInCloud(notificationId: string): Promise<void> {
  if (!db || !notificationId) return;
  try {
    await setDoc(
      doc(db, WORKER_NOTIFICATIONS_COLLECTION, notificationId),
      { read: true },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not mark worker notification read:', err);
  }
}
