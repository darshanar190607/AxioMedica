/**
 * mobile/src/config/env.js
 * Environment configuration and mock data toggles.
 */
let Platform = { OS: 'ios' };
const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.JEST_WORKER_ID));
if (!isTestEnv && typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  try {
    const rn = require('react-native');
    if (rn?.Platform) Platform = rn.Platform;
  } catch {
    // Fallback
  }
}

// Toggle mock data for offline/demo presentations.
// Defaults to false so real API calls are used, but can be set via EXPO_PUBLIC_USE_MOCK=true
let _useMock = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export function isMockEnabled() {
  return _useMock;
}

export function setMockEnabled(value) {
  _useMock = Boolean(value);
}

// Fallback host depending on platform
function getDefaultBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Android emulator uses 10.0.2.2 to access host localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
}

export const ENV = {
  get API_BASE_URL() {
    return getDefaultBaseUrl();
  },
  get USE_MOCK() {
    return _useMock;
  },
};
