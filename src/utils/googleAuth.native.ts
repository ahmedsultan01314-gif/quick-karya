import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, type GoogleAuthResult } from '../firebase';
import { getMobileGoogleAuthCandidates } from '../config';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Ignore on runtimes where auth session completion is unnecessary
}

const APP_REDIRECT_URI = 'quickkarya://auth';

export function getGoogleWebClientId(): string {
  const envClientId =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ? String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).trim()
      : '';
  return envClientId || String(firebaseConfig.oAuthClientId || '').trim();
}

export function configureNativeGoogleSignIn(): void {
  // Warm up Chrome Custom Tabs on Android for faster Google OAuth launch;
  // avoids native GoogleSignin SHA-1 verification that causes Code 10.
  try {
    WebBrowser.warmUpAsync().catch(() => {});
  } catch {
    // ignore warm-up errors on unsupported environments
  }
}

export async function signOutNativeGoogle(): Promise<void> {
  try {
    await WebBrowser.coolDownAsync().catch(() => {});
  } catch {
    // ignore
  }
}

function createCancelledError(message = 'Google Sign-In was cancelled.'): Error & { isCancelled: boolean } {
  const cancelErr = new Error(message) as Error & { isCancelled: boolean };
  cancelErr.isCancelled = true;
  return cancelErr;
}

function parseCallbackParams(callbackUrl: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!callbackUrl) return result;

  const [beforeHash, hashPart = ''] = callbackUrl.split('#');
  const queryIdx = beforeHash.indexOf('?');
  const queryPart = queryIdx >= 0 ? beforeHash.slice(queryIdx + 1) : '';

  for (const segment of [queryPart, hashPart]) {
    if (!segment) continue;
    const params = new URLSearchParams(segment);
    params.forEach((value, key) => {
      if (value !== '') {
        result[key] = value;
      }
    });
  }
  return result;
}

async function resolveReachableBridgeUrl(): Promise<string | null> {
  const candidates = getMobileGoogleAuthCandidates();
  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`${candidate}?check=1`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      const data = await res.json().catch(() => null);
      if (data?.ok === true) {
        return candidate;
      }
    } catch {
      // Try next candidate
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return null;
}

async function openAuthSessionWithLinkingFallback(
  authUrl: string,
  redirectUrl: string
): Promise<{ type: 'success' | 'cancel' | 'dismiss'; url?: string }> {
  let subscription: { remove?: () => void } | null = null;
  const acceptedPrefixes = [redirectUrl, 'com.quickkarya.app://auth'];

  try {
    const linkingPromise = new Promise<{ type: 'success'; url: string }>((resolve) => {
      subscription = Linking.addEventListener('url', (event: { url?: string }) => {
        const incoming = event?.url || '';
        if (acceptedPrefixes.some((prefix) => incoming.startsWith(prefix))) {
          try {
            WebBrowser.dismissAuthSession();
          } catch {
            // ignore
          }
          resolve({ type: 'success', url: incoming });
        }
      });
    });

    const browserPromise = WebBrowser.openAuthSessionAsync(authUrl, redirectUrl).then((res) => {
      if (res.type === 'success' && 'url' in res && res.url) {
        return { type: 'success' as const, url: res.url };
      }
      return { type: (res.type === 'dismiss' ? 'dismiss' : 'cancel') as 'cancel' | 'dismiss' };
    });

    return await Promise.race([browserPromise, linkingPromise]);
  } finally {
    try {
      subscription?.remove?.();
    } catch {
      // ignore cleanup error
    }
  }
}

/**
 * Pure Web OAuth + Firebase Auth flow for Android APKs.
 * Uses Expo WebBrowser (Chrome Custom Tabs) + Firebase GoogleAuthProvider.credential(idToken)
 * with the project's Web Client ID, eliminating native Android SHA-1 Code 10 failures.
 */
export async function performNativeGoogleSignIn(): Promise<GoogleAuthResult> {
  const webClientId = getGoogleWebClientId();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error(
      `Google OAuth Web Client ID is missing for project ${firebaseConfig.projectId}. Please sign in with Email & Password below.`
    );
  }

  const bridgeUrl = await resolveReachableBridgeUrl();
  if (!bridgeUrl) {
    throw new Error(
      'Unable to connect to the Quick Karya Google Sign-In service right now. Please check your internet connection and try again, or use Email & Password below.'
    );
  }

  const state = `qk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const authUrl = `${bridgeUrl}?redirect=${encodeURIComponent(APP_REDIRECT_URI)}&state=${encodeURIComponent(state)}`;

  const authResult = await openAuthSessionWithLinkingFallback(authUrl, APP_REDIRECT_URI);
  if (authResult.type !== 'success' || !authResult.url) {
    throw createCancelledError('Google Sign-In was cancelled.');
  }

  const params = parseCallbackParams(authResult.url);
  if (params.error === 'cancelled') {
    throw createCancelledError('Google Sign-In was cancelled.');
  }
  if (params.error) {
    throw new Error(params.error);
  }
  if (params.state && params.state !== state) {
    throw new Error('Google Sign-In verification mismatch. Please try again.');
  }

  const email = (params.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Could not read the email address from the selected Google account.');
  }

  const displayName = (params.name || email.split('@')[0] || 'Quick Karya User').trim();
  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=001F3F&textColor=FFA500`;
  const photoUrl = params.photo || fallbackAvatar;

  let firebaseUid = params.uid || `google_${email.replace(/[^a-z0-9]/g, '_')}`;

  if (auth && (params.id_token || params.access_token)) {
    try {
      const credential = GoogleAuthProvider.credential(
        params.id_token || null,
        params.access_token || null
      );
      const userCred = await signInWithCredential(auth, credential);
      if (userCred?.user?.uid) {
        firebaseUid = userCred.user.uid;
      }
    } catch (fbErr: any) {
      const fbCode = String(fbErr?.code || '');
      console.warn('Firebase signInWithCredential notice:', fbCode, fbErr?.message);

      if (fbCode === 'auth/user-disabled') {
        throw new Error('This Google account has been disabled in Firebase Authentication.');
      }
      if (fbCode === 'auth/account-exists-with-different-credential') {
        throw new Error(
          'An account already exists with this email using Email & Password. Please sign in with Email & Password below.'
        );
      }
      if (fbCode === 'auth/operation-not-allowed') {
        throw new Error(
          'Google Sign-In is not enabled in Firebase Authentication. Please sign in with Email & Password below.'
        );
      }
      if (fbCode === 'auth/network-request-failed') {
        throw new Error(
          'Network error while completing Google sign-in. Please check your internet connection and try again.'
        );
      }
      if (!params.uid) {
        throw new Error(
          fbErr?.message || 'Unable to verify Google credentials with Firebase. Please try again.'
        );
      }
    }
  }

  return {
    uid: firebaseUid,
    name: displayName,
    email,
    photoUrl
  };
}
