/**
 * mobile/__tests__/offlineSync.test.js
 * Unit and integration tests for Phase 6.2 Offline Storage & Sync:
 *   - Offline save (saveSession saves to local SQLite with synced = 0)
 *   - Online sync (uploads unsynced sessions to POST /sessions/sync and marks synced = 1)
 *   - Retry after failure (exponential backoff on network/server errors)
 *   - Duplicate-safe resend (idempotent handling on client_uuid)
 *   - Offline active plan caching
 *   - Mutex protection against overlapping syncs
 */

import { sessionRepository, saveSession } from '../src/db/sessionRepository';
import { syncService } from '../src/services/syncService';
import { sessionsApi } from '../src/api/sessions';
import { getDatabase, resetDatabaseInstance } from '../src/db/database';
import NetInfo from '@react-native-community/netinfo';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock sessionsApi
jest.mock('../src/api/sessions', () => ({
  sessionsApi: {
    syncSession: jest.fn(),
    getSessions: jest.fn(),
    getSessionById: jest.fn(),
  },
}));

describe('Phase 6.2 Offline-First Storage and Sync Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    syncService._reset();
    resetDatabaseInstance();
    // Fresh in-memory database
    const db = await getDatabase();
    db.sessions.clear();
    db.sessionExercises.length = 0;
    db.repEvents.length = 0;
    db.cachedPlans.clear();
  });

  const samplePayload = {
    client_uuid: '11111111-2222-4333-8444-555555555555',
    plan_id: 'plan-ankle-1',
    started_at: '2026-10-12T10:00:00Z',
    ended_at: '2026-10-12T10:12:00Z',
    pose_model_ver: '1.0.0',
    app_version: '1.0.0',
    overall_score: 88.5,
    exercises: [
      {
        exercise_id: 1,
        sets_done: 2,
        reps_done: 5,
        avg_form_score: 88.5,
        max_rom_deg: 35.0,
        avg_rom_deg: 30.2,
        pain_before: 2,
        pain_after: 1,
        side: 'right',
        reps: [
          { set_no: 1, rep_no: 1, duration_ms: 1200, rom_deg: 30.0, form_score: 90, errors: [], confidence: 0.98 },
          { set_no: 1, rep_no: 2, duration_ms: 1150, rom_deg: 32.0, form_score: 88, errors: ['too_fast'], confidence: 0.95 },
        ],
      },
    ],
  };

  test('1. Offline Save: saves session with synced = 0 and reconstructs payload', async () => {
    const result = await saveSession(samplePayload);
    expect(result.client_uuid).toBe(samplePayload.client_uuid);
    expect(result.synced).toBe(0);

    // Verify pending count is 1
    const pendingCount = await sessionRepository.getPendingCount();
    expect(pendingCount).toBe(1);

    // Verify reconstructs full session with exercises and reps
    const unsynced = await sessionRepository.getUnsyncedSessions();
    expect(unsynced.length).toBe(1);
    expect(unsynced[0].client_uuid).toBe(samplePayload.client_uuid);
    expect(unsynced[0].exercises.length).toBe(1);
    expect(unsynced[0].exercises[0].reps.length).toBe(2);
    expect(unsynced[0].exercises[0].reps[1].errors).toEqual(['too_fast']);
  });

  test('2. Online Sync: uploads unsynced sessions to POST /sessions/sync and marks synced = 1', async () => {
    await saveSession(samplePayload);
    expect(await sessionRepository.getPendingCount()).toBe(1);

    // Server returns success
    sessionsApi.syncSession.mockResolvedValueOnce({
      session_id: 'srv-123',
      client_uuid: samplePayload.client_uuid,
      metrics_updated: true,
    });

    const syncResult = await syncService.syncPendingSessions();
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(1);

    // API was called with exact payload
    expect(sessionsApi.syncSession).toHaveBeenCalledTimes(1);
    expect(sessionsApi.syncSession).toHaveBeenCalledWith(
      expect.objectContaining({
        client_uuid: samplePayload.client_uuid,
        overall_score: 88.5,
      })
    );

    // Session is now marked synced = 1
    const pendingAfter = await sessionRepository.getPendingCount();
    expect(pendingAfter).toBe(0);
  });

  test('3. Retry After Failure: retains unsynced flag and increments retry count with backoff', async () => {
    jest.useFakeTimers();

    await saveSession(samplePayload);
    expect(await sessionRepository.getPendingCount()).toBe(1);

    // Server throws network or 500 error
    sessionsApi.syncSession.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(syncService.syncPendingSessions()).rejects.toThrow('Network request failed');

    // Still unsynced
    expect(await sessionRepository.getPendingCount()).toBe(1);

    // Retry attempt registered
    const state = syncService.getState();
    expect(state.retryAttempt).toBe(1);
    expect(state.lastError).toBe('Network request failed');

    // Fast-forward backoff timer and succeed on next try
    sessionsApi.syncSession.mockResolvedValueOnce({ success: true });
    jest.advanceTimersByTime(1500);

    // Await second attempt
    await Promise.resolve(); // allow microtasks

    jest.useRealTimers();
  });

  test('4. Duplicate-Safe Resend: idempotently marks session synced if server returns 200 or 409', async () => {
    await saveSession(samplePayload);

    // Server says session already processed (409 conflict or existing 200)
    sessionsApi.syncSession.mockRejectedValueOnce({
      status: 409,
      message: 'Session with this client_uuid has already been synced.',
    });

    const syncResult = await syncService.syncPendingSessions();
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(1);

    // Correctly marked synced locally without throw
    const pendingAfter = await sessionRepository.getPendingCount();
    expect(pendingAfter).toBe(0);
  });

  test('5. Mutex: prevents concurrent overlapping sync executions', async () => {
    await saveSession(samplePayload);

    let resolveSync;
    const slowSyncPromise = new Promise(resolve => {
      resolveSync = resolve;
    });

    sessionsApi.syncSession.mockImplementationOnce(() => slowSyncPromise);

    // Launch first sync (which is waiting on slowSyncPromise)
    const firstSync = syncService.syncPendingSessions();

    // Launch second sync immediately
    const secondSync = await syncService.syncPendingSessions();
    expect(secondSync.skipped).toBe(true);
    expect(secondSync.reason).toBe('ALREADY_SYNCING');

    // Finish first sync
    resolveSync({ success: true });
    await firstSync;
  });

  test('6. Active Plan Cache: caches plan locally and retrieves offline', async () => {
    const dummyPlan = {
      id: 'plan-uuid-999',
      name: 'Ankle Inversion Recovery',
      exercises: [{ id: 1, name: 'Dorsiflexion' }],
    };

    await sessionRepository.cacheActivePlan(dummyPlan);
    const cached = await sessionRepository.getCachedActivePlan();
    expect(cached).toEqual(dummyPlan);
  });

  test('7. Offline Detection: skips sync immediately when NetInfo reports offline', async () => {
    await saveSession(samplePayload);

    NetInfo.fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });

    const result = await syncService.syncPendingSessions();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('OFFLINE');
    expect(sessionsApi.syncSession).not.toHaveBeenCalled();
  });

  test('8. API Client: single in-flight token refresh mutex on 401', async () => {
    const { apiClient } = require('../src/api/client');
    const { tokenStorage, StorageKeys } = require('../src/api/storage');

    await tokenStorage.setItem(StorageKeys.ACCESS_TOKEN, 'expired-token');
    await tokenStorage.setItem(StorageKeys.REFRESH_TOKEN, 'valid-refresh-token');

    let refreshCallCount = 0;
    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockImplementation((url, opts) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ access_token: 'new-token', refresh_token: 'valid-refresh-token' }),
        });
      }

      // First call with expired token returns 401
      if (opts?.headers?.Authorization === 'Bearer expired-token') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ detail: 'Token expired' }),
        });
      }

      // Retry call with new token returns 200
      if (opts?.headers?.Authorization === 'Bearer new-token') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      });
    });

    try {
      // Fire two concurrent requests that both get 401
      const [res1, res2] = await Promise.all([
        apiClient('/patients/me'),
        apiClient('/plans/active'),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      // Crucial: Single in-flight refresh! Exactly 1 refresh call was made despite 2 concurrent 401s
      expect(refreshCallCount).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
