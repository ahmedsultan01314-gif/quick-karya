import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, type GoogleAuthResult } from '../firebase';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Ignore on runtimes where auth session completion is unnecessary
}

const APP_RETURN_URL = 'quickkarya://auth';
const ANDROID_SCHEME_REDIRECT_URI = 'com.quickkarya.app:/oauth2redirect';
const EXPO_PROXY_REDIRECT_URI = 'https://auth.expo.io/@sultanquickkaryas-team/quick-karya';

export function getGoogleWebClientId(): string {
  const envClientId =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ? String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).trim()
      : '';
  return envClientId || String(firebaseConfig.oAuthClientId || '').trim();
}

export function getGoogleAndroidClientId(): string {
  return typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    ? String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID).trim()
    : '';
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

function randomToken(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}_${Math.random().toString(36).slice(2, 10)}`;
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

function decodeBase64UrlToUtf8(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const c1 = alphabet.indexOf(padded[i]);
    const c2 = alphabet.indexOf(padded[i + 1]);
    const c3 = padded[i + 2] === '=' ? -1 : alphabet.indexOf(padded[i + 2]);
    const c4 = padded[i + 3] === '=' ? -1 : alphabet.indexOf(padded[i + 3]);
    if (c1 < 0 || c2 < 0) break;

    bytes.push((c1 << 2) | (c2 >> 4));
    if (c3 >= 0) {
      bytes.push(((c2 & 15) << 4) | (c3 >> 2));
      if (c4 >= 0) {
        bytes.push(((c3 & 3) << 6) | c4);
      }
    }
  }

  let percentEncoded = '';
  for (let i = 0; i < bytes.length; i += 1) {
    percentEncoded += `%${bytes[i].toString(16).padStart(2, '0')}`;
  }
  return decodeURIComponent(percentEncoded);
}

function decodeIdTokenClaims(idToken?: string): {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
} {
  if (!idToken) return {};
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return {};
    const json = decodeBase64UrlToUtf8(parts[1]);
    const payload = JSON.parse(json);
    return {
      email: typeof payload?.email === 'string' ? payload.email : undefined,
      name: typeof payload?.name === 'string' ? payload.name : undefined,
      picture: typeof payload?.picture === 'string' ? payload.picture : undefined,
      sub: typeof payload?.sub === 'string' ? payload.sub : undefined
    };
  } catch {
    return {};
  }
}

async function openAuthSessionWithLinkingFallback(
  authUrl: string,
  redirectUrl: string,
  extraPrefixes: string[] = []
): Promise<{ type: 'success' | 'cancel' | 'dismiss'; url?: string }> {
  let subscription: { remove?: () => void } | null = null;
  const acceptedPrefixes = [redirectUrl, ...extraPrefixes].filter(Boolean);

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

async function exchangeAuthCodeForTokens(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ idToken?: string; accessToken?: string }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: params.codeVerifier
  }).toString();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (!data?.id_token && !data?.access_token)) {
    throw new Error(
      data?.error_description || data?.error || 'Could not exchange Google authorization code for tokens.'
    );
  }
  return {
    idToken: data.id_token ? String(data.id_token) : undefined,
    accessToken: data.access_token ? String(data.access_token) : undefined
  };
}

async function signInFirebaseWithIdpRest(idToken?: string, accessToken?: string): Promise<{
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}> {
  const postBodyParts: string[] = [];
  if (idToken) postBodyParts.push(`id_token=${encodeURIComponent(idToken)}`);
  if (accessToken) postBodyParts.push(`access_token=${encodeURIComponent(accessToken)}`);
  postBodyParts.push('providerId=google.com');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        postBody: postBodyParts.join('&'),
        requestUri: `https://${firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`}`,
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.localId) {
    const errMsg = String(data?.error?.message || 'Unable to verify Google credentials with Firebase.');
    if (errMsg.includes('OPERATION_NOT_ALLOWED')) {
      throw new Error(
        'Google Sign-In is disabled in Firebase Console. Enable Google under Authentication -> Sign-in method, or sign in with Email & Password below.'
      );
    }
    if (errMsg.includes('USER_DISABLED')) {
      throw new Error('This Google account has been disabled in Firebase Authentication.');
    }
    throw new Error(errMsg);
  }

  return {
    uid: String(data.localId),
    email: data.email ? String(data.email) : undefined,
    displayName: data.displayName || data.fullName ? String(data.displayName || data.fullName) : undefined,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined
  };
}

/**
 * Pure Web OAuth + Firebase Auth flow for Android APKs.
 * Connects directly to Google OAuth + Firebase Authentication without any external proxy/bridge health check
 * and without native GoogleSignin SHA-1 verification (no Code 10).
 */
export async function performNativeGoogleSignIn(): Promise<GoogleAuthResult> {
  const webClientId = getGoogleWebClientId();
  const androidClientId = getGoogleAndroidClientId();

  if (!androidClientId && (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com'))) {
    throw new Error(
      `Google OAuth Web Client ID is missing for project ${firebaseConfig.projectId}. Please sign in with Email & Password below.`
    );
  }

  const state = randomToken('qk');
  const nonce = randomToken('qn');

  let idToken: string | undefined;
  let accessToken: string | undefined;

  if (androidClientId && androidClientId.endsWith('.apps.googleusercontent.com')) {
    const codeVerifier = `${randomToken('qkv')}_${randomToken('pkce')}`;
    const googleQuery = new URLSearchParams({
      client_id: androidClientId,
      redirect_uri: ANDROID_SCHEME_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      prompt: 'select_account',
      code_challenge: codeVerifier,
      code_challenge_method: 'plain',
      state
    }).toString();

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${googleQuery}`;
    const authResult = await openAuthSessionWithLinkingFallback(authUrl, ANDROID_SCHEME_REDIRECT_URI, [
      APP_RETURN_URL,
      'com.quickkarya.app://auth'
    ]);

    if (authResult.type !== 'success' || !authResult.url) {
      throw createCancelledError('Google Sign-In was cancelled.');
    }

    const params = parseCallbackParams(authResult.url);
    if (params.error === 'access_denied' || params.error === 'cancelled') {
      throw createCancelledError('Google Sign-In was cancelled.');
    }
    if (params.error) {
      throw new Error(params.error_description || params.error);
    }
    if (params.state && params.state !== state) {
      throw new Error('Google Sign-In state mismatch. Please try again.');
    }
    if (!params.code) {
      throw new Error('Google Sign-In did not return an authorization code. Please try again.');
    }

    const tokens = await exchangeAuthCodeForTokens({
      code: params.code,
      clientId: androidClientId,
      redirectUri: ANDROID_SCHEME_REDIRECT_URI,
      codeVerifier
    });
    idToken = tokens.idToken;
    accessToken = tokens.accessToken;
  } else {
    // Web Client ID flow via Expo's HTTPS auth callback -> redirects directly back to quickkarya://auth
    const googleQuery = new URLSearchParams({
      client_id: webClientId,
      redirect_uri: EXPO_PROXY_REDIRECT_URI,
      response_type: 'id_token token',
      scope: 'openid profile email',
      prompt: 'select_account',
      nonce,
      state
    }).toString();

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${googleQuery}`;
    const startUrl = `${EXPO_PROXY_REDIRECT_URI}/start?authUrl=${encodeURIComponent(googleAuthUrl)}&returnUrl=${encodeURIComponent(APP_RETURN_URL)}`;

    const authResult = await openAuthSessionWithLinkingFallback(startUrl, APP_RETURN_URL, [
      'com.quickkarya.app://auth',
      ANDROID_SCHEME_REDIRECT_URI
    ]);

    if (authResult.type !== 'success' || !authResult.url) {
      throw createCancelledError('Google Sign-In was cancelled.');
    }

    const params = parseCallbackParams(authResult.url);
    if (params.error === 'access_denied' || params.error === 'cancelled') {
      throw createCancelledError('Google Sign-In was cancelled.');
    }
    if (params.errorCode === 'cookies-disabled') {
      throw new Error(
        'Browser cookies are disabled. Please enable cookies in Chrome to complete Google Sign-In, or use Email & Password below.'
      );
    }
    if (params.error) {
      throw new Error(params.error_description || params.error);
    }
    if (params.state && params.state !== state) {
      throw new Error('Google Sign-In verification mismatch. Please try again.');
    }

    idToken = params.id_token;
    accessToken = params.access_token;
  }

  if (!idToken && !accessToken) {
    throw new Error('Google Sign-In did not return credentials. Please try again or use Email & Password below.');
  }

  const claims = decodeIdTokenClaims(idToken);
  let firebaseUid = '';
  let email = (claims.email || '').trim().toLowerCase();
  let displayName = (claims.name || '').trim();
  let photoUrl = claims.picture || '';

  if (auth) {
    try {
      const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
      const userCred = await signInWithCredential(auth, credential);
      const fbUser = userCred.user;
      firebaseUid = fbUser.uid;
      email = (fbUser.email || email || '').trim().toLowerCase();
      displayName = (fbUser.displayName || displayName || '').trim();
      photoUrl = fbUser.photoURL || photoUrl;
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
          'Google Sign-In is disabled in Firebase Console. Enable Google under Authentication -> Sign-in method, or use Email & Password below.'
        );
      }
      if (fbCode === 'auth/network-request-failed') {
        throw new Error(
          'Network error while completing Google Sign-In. Please check your internet connection and try again.'
        );
      }
      throw new Error(
        fbErr?.message || 'Unable to verify Google credentials with Firebase. Please try again.'
      );
    }
  } else {
    const restUser = await signInFirebaseWithIdpRest(idToken, accessToken);
    firebaseUid = restUser.uid;
    email = (restUser.email || email || '').trim().toLowerCase();
    displayName = (restUser.displayName || displayName || '').trim();
    photoUrl = restUser.photoUrl || photoUrl;
  }

  if (!email) {
    throw new Error('Could not read the email address from the selected Google account.');
  }

  const finalName = displayName.length >= 2 ? displayName : email.split('@')[0] || 'Quick Karya User';
  const finalPhoto =
    photoUrl ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(finalName)}&backgroundColor=001F3F&textColor=FFA500`;

  return {
    uid: firebaseUid,
    name: finalName,
    email,
    photoUrl: finalPhoto
  };
}
