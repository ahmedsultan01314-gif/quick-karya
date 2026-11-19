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

let isConfigured = false;

export function configureNativeGoogleSignIn(): void {
  if (isConfigured) return;
  try {
    const webClientId = firebaseConfig.oAuthClientId;
    if (!webClientId) {
      console.warn('Google Sign-In warning: Missing oAuthClientId in firebase-applet-config.json');
      return;
    }
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
      forceCodeForRefreshToken: false
    });
    isConfigured = true;
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

  if (!firebaseConfig.oAuthClientId) {
    throw new Error(
      'Google OAuth Web Client ID is missing in firebase-applet-config.json. Please configure OAuth or use Email & Password.'
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
      const cancelErr: any = new Error('Google Sign-In was cancelled. Please select a Google account or use Email & Password.');
      cancelErr.isCancelled = true;
      throw cancelErr;
    }

    if (!isSuccessResponse(response)) {
      throw new Error('Google Sign-In did not return an account. Please try again.');
    }

    const { idToken, user } = response.data;
    const email = (user.email || '').trim().toLowerCase();
    const displayName =
      (user.name || [user.givenName, user.familyName].filter(Boolean).join(' ') || email.split('@')[0] || 'Quick Karya User').trim();
    const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=001F3F&textColor=FFA500`;
    const photoUrl = user.photo || fallbackAvatar;

    if (!email) {
      throw new Error('Could not read email address from the selected Google account.');
    }

    let firebaseUid = user.id ? `google_${user.id}` : `google_${email.replace(/[^a-z0-9]/g, '_')}`;

    if (auth && idToken) {
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        if (userCred?.user?.uid) {
          firebaseUid = userCred.user.uid;
        }
      } catch (fbErr: any) {
        console.warn('Firebase credential exchange warning:', fbErr?.code, fbErr?.message);
        if (fbErr?.code === 'auth/operation-not-allowed') {
          throw new Error(
            'Google Sign-In provider is disabled in Firebase Console Authentication settings. Please enable Google Sign-In or use Email & Password.'
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

    if (codeStr === '10' || msgStr.includes('DEVELOPER_ERROR') || msgStr.includes('10:')) {
      throw new Error(
        'Google OAuth Configuration Error (Code 10): The Android SHA-1 signing key for com.quickkarya.app is not registered in Firebase Console yet. Add your EAS APK SHA-1 in Firebase Console -> Project Settings -> Android app, or sign in with Email & Password below.'
      );
    }

    if (codeStr === '7' || msgStr.includes('NETWORK_ERROR')) {
      throw new Error('Network error during Google Sign-In. Please check your internet connection and try again.');
    }

    if (codeStr === '12500' || msgStr.includes('12500')) {
      throw new Error(
        'Google Sign-In failed (Code 12500). Please verify OAuth consent screen & SHA-1 configuration in Google Cloud / Firebase Console, or use Email & Password below.'
      );
    }

    throw new Error(
      err?.message || 'Unable to complete Google Sign-In on this device. Please try Email & Password below.'
    );
  }
}
