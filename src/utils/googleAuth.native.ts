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
        'Google Sign-In warning: Missing or invalid Web OAuth Client ID (expected *.apps.googleusercontent.com).'
      );
      return;
    }
    GoogleSignin.configure({
      webClientId,
      scopes: ['profile', 'email'],
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

export async function performNativeGoogleSignIn(): Promise<GoogleAuthResult> {
  configureNativeGoogleSignIn();

  const webClientId = getGoogleWebClientId();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error(
      'Google OAuth Web Client ID is missing or invalid. Please check firebase-applet-config.json (oAuthClientId) or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, or sign in with Email & Password below.'
    );
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (playErr: any) {
    if (isErrorWithCode(playErr) && playErr.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error(
        'Google Play Services is not available or needs updating on this device. Please update Google Play Services or use Email & Password Sign-In below.'
      );
    }
    throw new Error(
      playErr?.message ||
        'Google Play Services check failed on this phone. Please use Email & Password Sign-In below.'
    );
  }

  // Always sign out cached Google SDK state first so the Android Google Account Picker always pops up
  await GoogleSignin.signOut().catch(() => {});

  try {
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      const cancelErr: any = new Error(
        'Google Sign-In was cancelled. Please select a Google account or use Email & Password.'
      );
      cancelErr.isCancelled = true;
      throw cancelErr;
    }

    if (!isSuccessResponse(response)) {
      throw new Error('Google Sign-In did not return an account. Please try again.');
    }

    const { idToken, user } = response.data;
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
      throw new Error('Could not read email address from the selected Google account.');
    }

    if (!idToken) {
      throw new Error(
        `Google Sign-In did not return an ID token. Verify that Web Client ID (${webClientId}) belongs to Firebase project ${firebaseConfig.projectId}.`
      );
    }

    let firebaseUid = user.id ? `google_${user.id}` : `google_${email.replace(/[^a-z0-9]/g, '_')}`;

    if (auth) {
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        if (userCred?.user?.uid) {
          firebaseUid = userCred.user.uid;
        }
      } catch (fbErr: any) {
        const fbCode = String(fbErr?.code || '');
        console.warn('Firebase credential exchange error:', fbCode, fbErr?.message);
        if (fbCode === 'auth/operation-not-allowed') {
          throw new Error(
            'Google Sign-In provider is disabled in Firebase Console -> Authentication -> Sign-in method. Please enable Google Sign-In or use Email & Password.'
          );
        }
        if (fbCode === 'auth/invalid-credential') {
          throw new Error(
            'Firebase rejected the Google ID token (auth/invalid-credential). Ensure the Web Client ID in Firebase Authentication -> Google -> Web SDK configuration matches the configured Web Client ID.'
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
            'Network error while verifying Google sign-in with Firebase. Please check your internet connection and try again.'
          );
        }
        throw new Error(
          fbErr?.message || 'Failed to complete Firebase Google Authentication. Please try again.'
        );
      }
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
        case statusCodes.SIGN_IN_CANCELLED: {
          const cancelErr: any = new Error('Google Sign-In was cancelled.');
          cancelErr.isCancelled = true;
          throw cancelErr;
        }
        case statusCodes.IN_PROGRESS:
          throw new Error('Google Sign-In is already open. Please wait a moment and try again.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error(
            'Google Play Services is missing or outdated on this device. Please update it from Play Store or use Email & Password below.'
          );
        default:
          break;
      }
    }

    const codeStr = String(err?.code ?? '');
    const msgStr = String(err?.message ?? '');

    if (codeStr === '12501') {
      const cancelErr: any = new Error('Google Sign-In was cancelled.');
      cancelErr.isCancelled = true;
      throw cancelErr;
    }

    if (codeStr === '12502') {
      throw new Error('Google Sign-In is already in progress. Please wait a moment and try again.');
    }

    if (codeStr === '10' || msgStr.includes('DEVELOPER_ERROR') || msgStr.includes('10:')) {
      throw new Error(
        `Google OAuth Configuration Error (Code 10): The Android SHA-1 signing key for com.quickkarya.app is not registered in Firebase Console (${firebaseConfig.projectId}) yet. Register your EAS APK SHA-1 fingerprint under Firebase Console -> Project Settings -> Your apps -> com.quickkarya.app, or sign in with Email & Password below.`
      );
    }

    if (codeStr === '7' || msgStr.includes('NETWORK_ERROR')) {
      throw new Error('Network error during Google Sign-In. Please check your internet connection and try again.');
    }

    if (codeStr === '12500' || msgStr.includes('12500')) {
      throw new Error(
        'Google Sign-In failed (Code 12500). Please verify the OAuth Consent Screen (Support email) and SHA-1 fingerprint in Firebase Console / Google Cloud Console, or use Email & Password below.'
      );
    }

    throw new Error(
      err?.message || 'Unable to complete Google Sign-In on this device. Please try Email & Password below.'
    );
  }
}
