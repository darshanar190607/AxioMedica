/**
 * mobile/src/context/AuthContext.js
 * React Context providing authentication state, token persistence,
 * and user/patient profile lifecycle.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { tokenStorage, StorageKeys } from '../api/storage';
import { setOnAuthExpired } from '../api/client';
import { isMockEnabled } from '../config/env';
import { patient as mockPatient } from '../data/patientData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore session from SecureStore on startup
  useEffect(() => {
    let isMounted = true;

    async function bootstrapAsync() {
      try {
        const storedToken = await tokenStorage.getItem(StorageKeys.ACCESS_TOKEN);
        if (!storedToken) {
          if (isMounted) setIsLoading(false);
          return;
        }

        setToken(storedToken);

        // First attempt to load cached patient & user for immediate offline response
        const cachedPatientStr = await tokenStorage.getItem(StorageKeys.PATIENT);
        const cachedUserStr = await tokenStorage.getItem(StorageKeys.USER);
        if (cachedPatientStr) {
          try {
            const parsed = typeof cachedPatientStr === 'string' ? JSON.parse(cachedPatientStr) : cachedPatientStr;
            if (isMounted) setPatient(parsed);
          } catch {
            // Ignored
          }
        }
        if (cachedUserStr) {
          try {
            const parsedUser = typeof cachedUserStr === 'string' ? JSON.parse(cachedUserStr) : cachedUserStr;
            if (isMounted) setUser(parsedUser);
          } catch {
            // Ignored
          }
        }

        if (isMounted) {
          setIsAuthenticated(true);
        }

        // Try fresh profile from server if online
        try {
          const freshUser = await authApi.getUser();
          if (isMounted && freshUser) {
            setUser(freshUser);
            await tokenStorage.setItem(StorageKeys.USER, freshUser);
            if (freshUser.role === 'patient') {
              try {
                const freshPatient = await authApi.getMe();
                if (isMounted && freshPatient) {
                  setPatient(freshPatient);
                  await tokenStorage.setItem(StorageKeys.PATIENT, freshPatient);
                }
              } catch {
                // Ignore patient profile net err
              }
            } else {
              setPatient(null);
            }
          }
        } catch (netErr) {
          // If offline or network issue, cached profile keeps user logged in
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          setToken(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    bootstrapAsync();

    // Register callback for expired refresh token
    setOnAuthExpired(() => {
      if (isMounted) {
        setToken(null);
        setUser(null);
        setPatient(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    setIsLoading(true);
    try {
      if (isMockEnabled()) {
        const isClinicianUser = email.toLowerCase().includes('doctor') || email.toLowerCase().includes('clinician');
        const role = isClinicianUser ? 'clinician' : 'patient';
        const mockUser = {
          id: isClinicianUser ? 'mock-clinician-1' : 'mock-user-1',
          email,
          role,
          full_name: isClinicianUser ? 'Dr. Michael Torres' : 'Sarah Johnson',
        };
        setUser(mockUser);
        setPatient(isClinicianUser ? null : mockPatient);
        setToken('mock-access-token');
        setIsAuthenticated(true);
        return { success: true, role };
      }

      const loginData = await authApi.login(email, password);
      setToken(loginData.access_token);

      // 1. Fetch user identity to inspect role (patient vs clinician vs admin)
      const userProfile = await authApi.getUser();
      setUser(userProfile);
      await tokenStorage.setItem(StorageKeys.USER, userProfile);

      const userRole = userProfile?.role || 'patient';

      // 2. Only fetch patient profile if user is a patient (clinicians do not have /patients/me)
      if (userRole === 'patient') {
        try {
          const patientData = await authApi.getMe();
          setPatient(patientData);
          await tokenStorage.setItem(StorageKeys.PATIENT, patientData);
        } catch (patientErr) {
          console.warn('Could not load patient profile:', patientErr.message);
        }
      } else {
        setPatient(null);
      }

      setIsAuthenticated(true);
      return { success: true, role: userRole, data: loginData };
    } catch (err) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setToken(null);
      setUser(null);
      setPatient(null);
      setIsAuthenticated(false);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const refreshPatient = useCallback(async () => {
    if (isMockEnabled()) {
      setPatient(mockPatient);
      return mockPatient;
    }
    try {
      const fresh = await authApi.getMe();
      if (fresh) {
        setPatient(fresh);
        if (fresh?.user) {
          setUser(fresh.user);
        }
      }
      return fresh;
    } catch (err) {
      return null;
    }
  }, []);

  const updatePatient = useCallback(async (updates) => {
    if (isMockEnabled()) {
      setPatient(prev => ({ ...prev, ...updates }));
      return updates;
    }
    const updated = await authApi.updateMe(updates);
    if (updated) {
      setPatient(updated);
      if (updated?.user) {
        setUser(updated.user);
      }
    }
    return updated;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = {
    user,
    patient,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshPatient,
    updatePatient,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
