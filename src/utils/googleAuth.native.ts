import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
  isCancelledResponse
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, type GoogleAuthResult } from '../firebase';

let configuredClientId: string | null = null;

export function getGoogleWebClientId(): string {
  const envClientId =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ? String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).trim()
      : '';
  return envClientId || String(firebaseConfig.oAuthClientId || '').trim();
}

export function configureNativeGoogleSignIn(): void {
  const webClientId = getGoogleWebClientId();
  if (configuredClientId === webClientId && webClientId) return;
  try {
    if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
      console.warn(
        'Google Sign-In configuration error: Missing or invalid Web OAuth Client ID (expected *.apps.googleusercontent.com).'
      );
      return;
    }
    // DEFAULT_SIGN_IN already includes email, profile, and openid; omit non-URI scope literals.
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false
    });
    configuredClientId = webClientId;
  } catch (err) {
    console.warn('GoogleSignin.configure error:', err);
  }
}

export async function signOutNativeGoogle(): Promise<void> {
  try {
    configureNativeGoogleSignIn();
    await GoogleSignin.signOut().catch(() => {});
  } catch {
    // ignore if not signed in
  }
}

function createCancelledError(message = 'Google Sign-In was cancelled.'): Error & { isCancelled: boolean } {
  const cancelErr = new Error(message) as Error & { isCancelled: boolean };
  cancelErr.isCancelled = true;
  return cancelErr;
}

export async function performNativeGoogleSignIn(): Promise<GoogleAuthResult> {
  configureNativeGoogleSignIn();

  const webClientId = getGoogleWebClientId();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error(
      `Google OAuth Web Client ID is missing or invalid for Firebase project ${firebaseConfig.projectId}. Configure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID or firebase-applet-config.json (oAuthClientId).`
    );
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (playErr: any) {
    if (isErrorWithCode(playErr) && playErr.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error(
        'Google Play Services is not available or needs updating on this Android device. Please update Google Play Services or use Email & Password below.'
      );
    }
    throw new Error(
      playErr?.message ||
        'Google Play Services verification failed on this device. Please try again or use Email & Password below.'
    );
  }

  // Clear cached Google SDK selection so the Android account chooser always appears
  await GoogleSignin.signOut().catch(() => {});

  try {
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      throw createCancelledError('Google Sign-In was cancelled.');
    }

    if (!isSuccessResponse(response)) {
      throw new Error('Google Sign-In did not return a valid Google account response. Please try again.');
    }

    const { user } = response.data;
    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens().catch(() => null);
      idToken = tokens?.idToken || null;
    }

    const email = (user.email || '').trim().toLowerCase();
    const displayName = (
      user.name ||
      [user.givenName, user.familyName].filter(Boolean).join(' ') ||
      email.split('@')[0] ||
      'Quick Karya User'
    ).trim();
    const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=001F3F&textColor=FFA500`;
    const photoUrl = user.photo || fallbackAvatar;

    if (!email) {
      throw new Error('Could not read the email address from the selected Google account.');
    }

    if (!idToken) {
      throw new Error(
        `Google Sign-In did not return an ID token. Verify that Web Client ID (${webClientId}) belongs to Firebase project ${firebaseConfig.projectId} and matches Firebase Authentication -> Google -> Web SDK configuration.`
      );
    }

    if (!auth) {
      throw new Error('Firebase Authentication is not initialized on this device.');
    }

    let firebaseUid: string;
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);
      firebaseUid = userCred.user.uid;
    } catch (fbErr: any) {
      const fbCode = String(fbErr?.code || '');
      console.warn('Firebase signInWithCredential error:', fbCode, fbErr?.message);

      if (fbCode === 'auth/operation-not-allowed') {
        throw new Error(
          `Google Sign-In provider is disabled in Firebase Console (${firebaseConfig.projectId}) -> Authentication -> Sign-in method -> Google.`
        );
      }
      if (fbCode === 'auth/invalid-credential') {
        throw new Error(
          `Firebase rejected the Google ID token (auth/invalid-credential). Verify that the Web Client ID (${webClientId}) matches Firebase Console -> Authentication -> Sign-in method -> Google -> Web SDK configuration -> Web client ID.`
        );
      }
      if (fbCode === 'auth/user-disabled') {
        throw new Error('This Google account has been disabled in Firebase Authentication.');
      }
      if (fbCode === 'auth/account-exists-with-different-credential') {
        throw new Error(
          'An account already exists with this email using Email & Password. Please sign in with Email & Password below.'
        );
      }
      if (fbCode === 'auth/network-request-failed') {
        throw new Error(
          'Network error while authenticating with Firebase. Please check your internet connection and try again.'
        );
      }
      throw new Error(
        fbErr?.message || 'Failed to complete Firebase Google Authentication (`signInWithCredential`).'
      );
    }

    return {
      uid: firebaseUid,
      name: displayName,
      email,
      photoUrl
    };
  } catch (err: any) {
    if (err?.isCancelled) {
      throw err;
    }

    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw createCancelledError('Google Sign-In was cancelled.');
        case statusCodes.IN_PROGRESS:
          throw new Error('Google Sign-In is already open. Please wait a moment and try again.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error(
            'Google Play Services is missing or outdated on this device. Please update it from Google Play Store.'
          );
        default:
          break;
      }
    }

    const codeStr = String(err?.code ?? '');
    const msgStr = String(err?.message ?? '');

    if (codeStr === '12501') {
      throw createCancelledError('Google Sign-In was cancelled.');
    }

    if (codeStr === '12502') {
      throw new Error('Google Sign-In is already in progress. Please wait a moment and try again.');
    }

    if (codeStr === '10' || msgStr.includes('DEVELOPER_ERROR') || msgStr.includes('10:')) {
      throw new Error(
        `Google Sign-In Error Code 10 (DEVELOPER_ERROR): The EAS Android keystore SHA-1 fingerprint for com.quickkarya.app is not registered in Firebase Console (${firebaseConfig.projectId}), or google-services.json / Web Client ID (${webClientId}) is missing or mismatched.`
      );
    }

    if (codeStr === '7' || msgStr.includes('NETWORK_ERROR')) {
      throw new Error('Network error during Google Sign-In. Please check your internet connection and try again.');
    }

    if (codeStr === '12500' || msgStr.includes('12500')) {
      throw new Error(
        `Google Sign-In failed (Code 12500): Verify the OAuth consent screen support email and SHA-1 fingerprint for com.quickkarya.app in Firebase project ${firebaseConfig.projectId}.`
      );
    }

    throw new Error(
      err?.message || 'Unable to complete Google Sign-In on this device. Please try again or use Email & Password below.'
    );
  }
}
