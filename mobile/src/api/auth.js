/**
 * mobile/src/api/auth.js
 * Authentication and Patient profile endpoints.
 */
import { apiClient } from './client';
import { tokenStorage, StorageKeys } from './storage';

export const authApi = {
  /**
   * Log in user with email & password.
   * On success, stores access & refresh tokens in secure storage.
   */
  async login(email, password) {
    const data = await apiClient('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (data?.access_token) {
      await tokenStorage.setItem(StorageKeys.ACCESS_TOKEN, data.access_token);
    }
    if (data?.refresh_token) {
      await tokenStorage.setItem(StorageKeys.REFRESH_TOKEN, data.refresh_token);
    }

    return data;
  },

  /**
   * Refresh the access token using the stored refresh token.
   */
  async refresh(refreshToken) {
    const data = await apiClient('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    });

    if (data?.access_token) {
      await tokenStorage.setItem(StorageKeys.ACCESS_TOKEN, data.access_token);
    }
    if (data?.refresh_token) {
      await tokenStorage.setItem(StorageKeys.REFRESH_TOKEN, data.refresh_token);
    }

    return data;
  },

  /**
   * Invalidate the current session and clear local tokens.
   */
  async logout() {
    try {
      const refreshToken = await tokenStorage.getItem(StorageKeys.REFRESH_TOKEN);
      if (refreshToken) {
        await apiClient('/auth/logout', {
          method: 'POST',
          body: { refresh_token: refreshToken },
        });
      }
    } catch {
      // Ignore network errors on logout, proceed with local cleanup
    } finally {
      await tokenStorage.clearTokens();
    }
  },

  /**
   * Fetch current authenticated patient's profile.
   */
  async getMe() {
    const data = await apiClient('/patients/me', { method: 'GET' });
    if (data?.patient) {
      await tokenStorage.setItem(StorageKeys.PATIENT, data.patient);
      if (data.patient.user) {
        await tokenStorage.setItem(StorageKeys.USER, data.patient.user);
      }
    }
    return data?.patient || data;
  },

  /**
   * Update profile fields (full_name, phone, bio, date_of_birth).
   */
  async updateMe(updates) {
    const data = await apiClient('/patients/me', {
      method: 'PATCH',
      body: updates,
    });
    if (data?.patient) {
      await tokenStorage.setItem(StorageKeys.PATIENT, data.patient);
    }
    return data?.patient || data;
  },
};
