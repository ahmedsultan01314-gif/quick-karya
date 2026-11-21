import type { FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function initFirebaseAuth(app: FirebaseApp): Auth {
  try {
    const getRNPersistence = (firebaseAuth as any)?.getReactNativePersistence;
    if (typeof initializeAuth === 'function' && typeof getRNPersistence === 'function') {
      return initializeAuth(app, {
        persistence: getRNPersistence(AsyncStorage)
      });
    }
  } catch {
    // Already initialized (e.g. Fast Refresh); fall back to existing instance
  }
  return getAuth(app);
}
