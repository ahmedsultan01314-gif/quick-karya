/**
 * Verified Backend Base URL Configuration for Quick Karya
 * In React Native Android / iOS, relative fetch paths (e.g. '/api/...') throw
 * 'MalformedURLException: no protocol' because native OkHttp requires an absolute URL.
 * In Web browsers, relative paths automatically resolve against window.location.origin.
 */

export const DEPLOYED_BACKEND_URL =
  'https://ais-dev-hpm4hugeyt2slmwiro2zk5-94418484178.asia-southeast1.run.app';

export const BACKEND_BASE_URL: string = (() => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/+$/, '');
  }
  if (typeof process !== 'undefined' && process.env?.VITE_APP_URL) {
    return process.env.VITE_APP_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin.replace(/\/+$/, '');
  }
  return DEPLOYED_BACKEND_URL;
})();

/**
 * Returns a guaranteed absolute URL on native Android/iOS and standard URL on Web.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // On web browser, relative path is safe and avoids any CORS mismatches
  const isWebBrowser =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof window.location?.origin === 'string';

  if (isWebBrowser) {
    return cleanPath;
  }
  // On native Android/iOS, absolute URL with protocol is strictly required
  return `${BACKEND_BASE_URL}${cleanPath}`;
}
