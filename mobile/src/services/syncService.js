/**
 * mobile/src/services/syncService.js
 * Offline-first background synchronization service:
 *   - Monitors network connectivity via NetInfo
 *   - Enforces a mutex so sync operations never overlap
 *   - Exponential backoff retry on failures
 *   - Uploads unsynced sessions to POST /sessions/sync
 *   - Idempotent on sessions.client_uuid
 *   - Updates UI listeners with pending / synced state
 */
import NetInfo from '@react-native-community/netinfo';
import { sessionRepository } from '../db/sessionRepository';
import { sessionsApi } from '../api/sessions';

let isSyncing = false;
let retryAttempt = 0;
let retryTimer = null;
let lastSyncTime = null;
let lastError = null;

const listeners = new Set();

function emitStatus(pendingCount = 0) {
  const state = {
    isSyncing,
    pendingCount,
    lastSyncTime,
    lastError,
  };
  listeners.forEach(fn => {
    try {
      fn(state);
    } catch {
      // Ignored
    }
  });
}

export const syncService = {
  /**
   * Subscribe to sync state changes.
   *
   * @param {function} listener
   * @returns {function} unsubscribe
   */
  subscribe(listener) {
    listeners.add(listener);
    sessionRepository.getPendingCount().then(c => {
      listener({
        isSyncing,
        pendingCount: c,
        lastSyncTime,
        lastError,
      });
    }).catch(() => {
      listener({
        isSyncing,
        pendingCount: 0,
        lastSyncTime,
        lastError,
      });
    });

    return () => listeners.delete(listener);
  },

  /**
   * Triggers upload of unsynced sessions to POST /sessions/sync.
   * Guarded by mutex and online check.
   */
  async syncPendingSessions() {
    // 1. Mutex guard: prevent overlapping syncs (acquired synchronously!)
    if (isSyncing) {
      return { skipped: true, reason: 'ALREADY_SYNCING' };
    }
    isSyncing = true;

    // 2. Check network state
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || netState.isInternetReachable === false) {
        isSyncing = false;
        const count = await sessionRepository.getPendingCount();
        emitStatus(count);
        return { skipped: true, reason: 'OFFLINE', pendingCount: count };
      }
    } catch {
      // If NetInfo fetch fails, proceed with attempt
    }

    lastError = null;
    let pendingCount = await sessionRepository.getPendingCount();
    emitStatus(pendingCount);

    try {
      const unsynced = await sessionRepository.getUnsyncedSessions();
      if (unsynced.length === 0) {
        retryAttempt = 0;
        isSyncing = false;
        emitStatus(0);
        return { success: true, syncedCount: 0 };
      }

      let successCount = 0;
      for (const sessionPayload of unsynced) {
        try {
          // POST /sessions/sync is idempotent on client_uuid
          await sessionsApi.syncSession(sessionPayload);
          await sessionRepository.markSessionSynced(sessionPayload.client_uuid);
          successCount++;
        } catch (err) {
          // If server already has it (idempotent 200 or conflict), mark synced
          if (err?.status === 200 || err?.status === 409) {
            await sessionRepository.markSessionSynced(sessionPayload.client_uuid);
            successCount++;
          } else {
            // Re-throw so backoff handles retry
            throw err;
          }
        }
      }

      lastSyncTime = new Date().toISOString();
      retryAttempt = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }

      pendingCount = await sessionRepository.getPendingCount();
      return { success: true, syncedCount: successCount, pendingCount };
    } catch (err) {
      lastError = err?.message || 'Sync failed';
      // Schedule exponential backoff retry
      this.scheduleRetry();
      throw err;
    } finally {
      isSyncing = false;
      pendingCount = await sessionRepository.getPendingCount().catch(() => 0);
      emitStatus(pendingCount);
    }
  },

  /**
   * Schedules next retry with exponential backoff: 1s, 2s, 4s, 8s, up to 30s.
   */
  scheduleRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    retryAttempt++;
    const delayMs = Math.min(1000 * Math.pow(2, retryAttempt - 1), 30000);

    retryTimer = setTimeout(() => {
      this.syncPendingSessions().catch(() => {
        // Will re-schedule in catch block
      });
    }, delayMs);
  },

  /**
   * Initializes network change listener to trigger auto-sync when online.
   */
  init() {
    try {
      NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable !== false) {
          this.syncPendingSessions().catch(() => {});
        }
      });
    } catch {
      // Ignored in test/unsupported environments
    }
  },

  /**
   * Helper to inspect internal sync state (used in unit tests).
   */
  getState() {
    return {
      isSyncing,
      retryAttempt,
      lastSyncTime,
      lastError,
    };
  },

  /**
   * Reset internal sync state (used in unit tests).
   */
  _reset() {
    isSyncing = false;
    retryAttempt = 0;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    lastSyncTime = null;
    lastError = null;
  },
};

// Auto-initialize listener
syncService.init();
