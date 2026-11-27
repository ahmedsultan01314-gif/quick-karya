import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, type GoogleAuthResult } from '../firebase';

let configuredWebClientId = '';

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '149463790904-u3gf07vile2kskuvad69fu7b18utm6pb.apps.googleusercontent.com';

export function getGoogleWebClientId(): string {
  const envClientId =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ? String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).trim()
      : '';
  return envClientId || String(firebaseConfig.oAuthClientId || '').trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID;
}

export function configureNativeGoogleSignIn(): void {
  const webClientId = getGoogleWebClientId();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    return;
  }
  if (configuredWebClientId === webClientId) {
    return;
  }

  try {
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
      scopes: ['profile', 'email']
    });
    configuredWebClientId = webClientId;
  } catch (err) {
    console.warn('Native GoogleSignin.configure notice:', err);
  }
}

export async function signOutNativeGoogle(): Promise<void> {
  try {
    configureNativeGoogleSignIn();
    await GoogleSignin.signOut().catch(() => {});
  } catch {
    // ignore native sign-out errors
  }
}

function createCancelledError(message = 'Google Sign-In was cancelled.'): Error & { isCancelled: boolean } {
  const cancelErr = new Error(message) as Error & { isCancelled: boolean };
  cancelErr.isCancelled = true;
  return cancelErr;
}

async function signInFirebaseWithTokenRest(options: {
  idToken?: string;
  accessToken?: string;
}): Promise<{
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}> {
  const postBodyParts: string[] = [];
  if (options.idToken) postBodyParts.push(`id_token=${encodeURIComponent(options.idToken)}`);
  if (options.accessToken) postBodyParts.push(`access_token=${encodeURIComponent(options.accessToken)}`);
  postBodyParts.push('providerId=google.com');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        requestUri: 'http://localhost',
        postBody: postBodyParts.join('&'),
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
 * Native Android Google Account Picker via @react-native-google-signin/google-signin + Firebase Auth.
 * Displays the device's system "Choose an account" sheet showing the Google accounts
 * signed into that user's phone, then authenticates directly into Firebase Auth with signInWithCredential.
 */
export async function performNativeGoogleSignIn(): Promise<GoogleAuthResult> {
  const webClientId = getGoogleWebClientId();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error(
      `Google OAuth Web Client ID is missing for project ${firebaseConfig.projectId}. Please sign in with Email & Password below.`
    );
  }

  configureNativeGoogleSignIn();

  let idToken: string | undefined;
  let accessToken: string | undefined;
  let pickedEmail = '';
  let pickedName = '';
  let pickedPhoto = '';

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Clear any cached native selection so Android always opens the device's
    // "Choose an account" picker showing all Google accounts on this phone.
    await GoogleSignin.signOut().catch(() => {});

    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      throw createCancelledError('Google Sign-In was cancelled.');
    }
    if (!isSuccessResponse(response)) {
      throw new Error('Google Sign-In did not complete. Please try again.');
    }

    const googleProfile = response.data.user;
    pickedEmail = (googleProfile?.email || '').trim().toLowerCase();
    pickedName = (googleProfile?.name || googleProfile?.givenName || '').trim();
    pickedPhoto = googleProfile?.photo || '';
    idToken = response.data.idToken || undefined;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens().catch(() => null);
      idToken = tokens?.idToken || undefined;
      accessToken = tokens?.accessToken || undefined;
    }
  } catch (err: any) {
    if (err?.isCancelled) {
      throw err;
    }

    const rawCode = err?.code !== undefined && err?.code !== null ? String(err.code) : '';
    const rawMessage = String(err?.message || '');

    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw createCancelledError('Google Sign-In was cancelled.');
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new Error('Google Sign-In is already in progress. Please wait a moment and try again.');
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error(
          'Google Play Services is unavailable or outdated on this device. Please update Google Play Services or use Email & Password below.'
        );
      }
    }

    if (
      rawCode === '10' ||
      rawCode === 'DEVELOPER_ERROR' ||
      /developer_error|status\s*code\s*[:=]?\s*10\b|error\s*code\s*[:=]?\s*10\b|:\s*10\b/i.test(rawMessage)
    ) {
      throw new Error(
        `Google Sign-In configuration error (Code 10 / DEVELOPER_ERROR). Register this Android APK's SHA-1 fingerprint for com.quickkarya.app in Firebase Console (${firebaseConfig.projectId} -> Project Settings -> Your apps -> Add fingerprint, then download google-services.json). You can also sign in right away using Email & Password below.`
      );
    }

    if (rawCode === '12501' || /cancel/i.test(rawMessage)) {
      throw createCancelledError('Google Sign-In was cancelled.');
    }

    if (rawCode === '7' || /network/i.test(rawMessage)) {
      throw new Error('Network error while connecting to Google Play Services. Check your internet connection and try again.');
    }

    throw new Error(
      rawMessage || 'Google Sign-In could not be completed on this device. Please try again or use Email & Password below.'
    );
  }

  if (!idToken && !accessToken) {
    throw new Error(
      `Google Sign-In did not return an ID token. Verify Web Client ID (${webClientId}) and Android SHA-1 in Firebase Console (${firebaseConfig.projectId}), or use Email & Password below.`
    );
  }

  let firebaseUid = '';
  let email = pickedEmail;
  let displayName = pickedName;
  let photoUrl = pickedPhoto;

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
          'Network error while completing Firebase Google Sign-In. Please check your internet connection and try again.'
        );
      }
      throw new Error(
        fbErr?.message || 'Unable to complete Firebase Google Sign-In. Please try again.'
      );
    }
  } else {
    const restUser = await signInFirebaseWithTokenRest({ idToken, accessToken });
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
