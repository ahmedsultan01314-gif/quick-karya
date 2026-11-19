import { signInWithGoogle, type GoogleAuthResult } from '../firebase';

export function configureNativeGoogleSignIn(): void {
  // Web uses Firebase signInWithPopup directly; no native GoogleSignin configuration needed
}

export async function performNativeGoogleSignIn(): Promise<GoogleAuthResult> {
  return signInWithGoogle();
}

export async function signOutNativeGoogle(): Promise<void> {
  // Handled by Firebase signOut on web
}
