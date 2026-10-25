/**
 * mobile/src/hooks/useSession.js
 * React hook for managing session persistence and sync state.
 */
import { useState, useEffect, useCallback } from 'react';
import { sessionRepository } from '../db/sessionRepository';
import { syncService } from '../services/syncService';

export function useSession() {
  const [syncState, setSyncState] = useState({
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null,
  });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((state) => {
      setSyncState(state);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await sessionRepository.getRecentSessions(20);
      setSessions(list);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSession = useCallback(async (payload) => {
    const res = await sessionRepository.saveSession(payload);
    // Trigger background sync attempt
    syncService.syncNow().catch(() => {});
    return res;
  }, []);

  return {
    syncState,
    sessions,
    loading,
    refreshSessions,
    saveSession,
    syncNow: syncService.syncNow,
  };
}

export default useSession;
