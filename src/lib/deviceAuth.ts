// One-Time Device Enrollment & Authorization System (3 Shop Phones)
// No daily logins, no passwords required during billing.
// Stores token securely in localStorage and validates against authorized devices.

const DEVICE_TOKEN_KEY = 'vcs_shop_device_token';
const DEVICE_NAME_KEY = 'vcs_shop_device_name';

/**
 * Generate a cryptographically secure device UUID token
 */
export function generateDeviceUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'dev_' + crypto.randomUUID().replace(/-/g, '');
  }
  return 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Get enrolled device token from local storage
 */
export function getEnrolledDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Get enrolled device friendly name (e.g. "Counter Phone 1")
 */
export function getEnrolledDeviceName(): string | null {
  try {
    return localStorage.getItem(DEVICE_NAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Save enrolled device locally
 */
export function saveEnrolledDevice(token: string, name: string): void {
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    localStorage.setItem(DEVICE_NAME_KEY, name);
  } catch (e) {
    console.error('Failed to save device auth to localStorage', e);
  }
}

/**
 * Clear device registration (if revoked)
 */
export function clearEnrolledDevice(): void {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(DEVICE_NAME_KEY);
  } catch (e) {
    console.error('Failed to clear device auth', e);
  }
}

/**
 * Detect client device model / user agent info for audit
 */
export function getClientDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  let model = 'Web Browser';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android[^;]+; ([^;)]+)/);
    model = match ? `Android (${match[1]})` : 'Android Device';
  } else if (/iPhone|iPad/i.test(ua)) {
    model = 'Apple iOS';
  } else if (/Windows/i.test(ua)) {
    model = 'Windows POS Terminal';
  }
  return model;
}

/**
 * Predefined shop phone names for convenient 1-tap setup
 */
export const SHOP_PHONE_SLOTS = [
  { name: 'Shop Phone 1 (Main Billing Counter)', slot: 1 },
  { name: 'Shop Phone 2 (Floor / Sales Staff)', slot: 2 },
  { name: 'Shop Phone 3 (Stock & Manager)', slot: 3 },
];
