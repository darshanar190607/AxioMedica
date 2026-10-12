/**
 * mobile/src/api/storage.js
 * Cross-platform secure token & credential storage.
 * Uses expo-secure-store on native platforms, falls back to localStorage/memory on web/test.
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

let SecureStore = null;
if (!isTestEnv) {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // Fallback
  }
}

const memoryStore = new Map();

export const StorageKeys = {
  ACCESS_TOKEN: 'axiomedica_access_token',
  REFRESH_TOKEN: 'axiomedica_refresh_token',
  USER: 'axiomedica_user',
  PATIENT: 'axiomedica_patient',
};

export const tokenStorage = {
  async setItem(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, stringValue);
          return;
        }
      } catch {
        // Fall back to memoryStore
      }
      memoryStore.set(key, stringValue);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, stringValue);
    } catch {
      memoryStore.set(key, stringValue);
    }
  },

  async getItem(key) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        // Fall back to memoryStore
      }
      return memoryStore.get(key) || null;
    }

    try {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null && val !== undefined) {
        return val;
      }
      return memoryStore.get(key) || null;
    } catch {
      return memoryStore.get(key) || null;
    }
  },

  async deleteItem(key) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Ignored
      }
      memoryStore.delete(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignored
    }
    memoryStore.delete(key);
  },

  async clearTokens() {
    await this.deleteItem(StorageKeys.ACCESS_TOKEN);
    await this.deleteItem(StorageKeys.REFRESH_TOKEN);
    await this.deleteItem(StorageKeys.USER);
    await this.deleteItem(StorageKeys.PATIENT);
  },
};
