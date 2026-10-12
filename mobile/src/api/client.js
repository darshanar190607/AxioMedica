/**
 * mobile/src/api/client.js
 * Central HTTP client wrapping fetch:
 *   - Base URL from environment config
 *   - Auto-attaches Bearer JWT access token
 *   - Intercepts 401 Unauthorized with a single in-flight token refresh mutex
 *   - Retries original request after successful refresh
 *   - Emits session expiration on failed refresh
 */
import { ENV } from '../config/env';
import { tokenStorage, StorageKeys } from './storage';

export class ApiError extends Error {
  constructor(message, status = 500, code = 'ERROR', data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Single in-flight refresh promise to prevent refresh stampedes
let refreshPromise = null;
let onAuthExpiredHandler = null;

export function setOnAuthExpired(callback) {
  onAuthExpiredHandler = callback;
}

/**
 * Executes a single in-flight refresh call to /auth/refresh.
 * Returns the new access token, or throws if refresh failed.
 */
async function performTokenRefresh() {
  const refreshToken = await tokenStorage.getItem(StorageKeys.REFRESH_TOKEN);
  if (!refreshToken) {
    throw new ApiError('No refresh token available.', 401, 'UNAUTHORIZED');
  }

  const baseUrl = ENV.API_BASE_URL.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    await tokenStorage.clearTokens();
    if (onAuthExpiredHandler) {
      onAuthExpiredHandler();
    }
    throw new ApiError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
  }

  const data = await response.json();
  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token || refreshToken;

  await tokenStorage.setItem(StorageKeys.ACCESS_TOKEN, newAccessToken);
  await tokenStorage.setItem(StorageKeys.REFRESH_TOKEN, newRefreshToken);

  return newAccessToken;
}

/**
 * Performs an HTTP request with auto-auth and 401 refresh handling.
 *
 * @param {string} endpoint - e.g. "/patients/me" or "/plans/active"
 * @param {object} [options={}] - fetch options (method, headers, body, etc.)
 * @param {boolean} [retryOn401=true] - internal flag to prevent infinite refresh loops
 * @returns {Promise<any>} Parsed JSON response or null for 204 No Content
 */
export async function apiClient(endpoint, options = {}, retryOn401 = true) {
  const baseUrl = ENV.API_BASE_URL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  // Read stored access token
  const accessToken = await tokenStorage.getItem(StorageKeys.ACCESS_TOKEN);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (accessToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    throw new ApiError(netErr.message || 'Network request failed', 0, 'NETWORK_ERROR');
  }

  // Intercept 401 Unauthorized
  if (response.status === 401 && retryOn401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    try {
      if (!refreshPromise) {
        refreshPromise = performTokenRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccessToken = await refreshPromise;

      // Retry original request with new token
      return apiClient(
        endpoint,
        {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        },
        false // Do not retry more than once
      );
    } catch (refreshErr) {
      throw refreshErr;
    }
  }

  if (response.status === 204) {
    return null;
  }

  let responseData = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      responseData?.detail ||
      responseData?.message ||
      `Request failed with status ${response.status}`;
    const errorCode = responseData?.code || 'API_ERROR';
    throw new ApiError(errorMsg, response.status, errorCode, responseData);
  }

  return responseData;
}
