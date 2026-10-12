/**
 * mobile/src/db/sessionRepository.js
 * Local repository for session telemetry, exercises, rep events, and cached plans.
 * Provides saveSession(payload) with synced = 0 for offline persistence.
 */
import { getDatabase } from './database';
import { generateUUID } from '../pose/sessionBuilder';

export const sessionRepository = {
  /**
   * Generates a new unique client UUID at the beginning of a recording session.
   *
   * @returns {string} UUID v4
   */
  generateSessionId() {
    return generateUUID();
  },

  /**
   * Saves a session payload locally with synced = 0.
   * Can be called directly by LiveMonitor or sessionBuilder on completion.
   *
   * @param {object} payload - SessionPayload matching docs/contracts/session_payload.schema.json
   * @returns {Promise<{ client_uuid: string, synced: number }>}
   */
  async saveSession(payload) {
    if (!payload || !Array.isArray(payload.exercises) || payload.exercises.length === 0) {
      throw new Error('Cannot save session: payload must contain at least one exercise.');
    }

    const db = await getDatabase();
    const clientUuid = payload.client_uuid || this.generateSessionId();
    const createdAt = new Date().toISOString();

    // 1. Insert into sessions table (synced = 0)
    await db.runAsync(
      `INSERT INTO sessions (
        client_uuid, plan_id, started_at, ended_at,
        pose_model_ver, app_version, overall_score, synced, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        clientUuid,
        payload.plan_id || null,
        payload.started_at || createdAt,
        payload.ended_at || createdAt,
        payload.pose_model_ver || '1.0.0',
        payload.app_version || '1.0.0',
        Number(payload.overall_score ?? 100),
        createdAt,
      ]
    );

    // 2. Insert into session_exercises and rep_events
    for (const ex of payload.exercises) {
      const exerciseId = Number(ex.exercise_id || 1);
      await db.runAsync(
        `INSERT INTO session_exercises (
          session_client_uuid, exercise_id, sets_done, reps_done,
          avg_form_score, max_rom_deg, avg_rom_deg, pain_before, pain_after, side
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientUuid,
          exerciseId,
          Number(ex.sets_done ?? 1),
          Number(ex.reps_done ?? (ex.reps?.length || 0)),
          Number(ex.avg_form_score ?? 100),
          Number(ex.max_rom_deg ?? 0),
          Number(ex.avg_rom_deg ?? 0),
          Number(ex.pain_before ?? 0),
          Number(ex.pain_after ?? 0),
          ex.side || 'right',
        ]
      );

      if (Array.isArray(ex.reps)) {
        for (const rep of ex.reps) {
          const errorsStr = Array.isArray(rep.errors) ? JSON.stringify(rep.errors) : '[]';
          await db.runAsync(
            `INSERT INTO rep_events (
              session_client_uuid, exercise_id, set_no, rep_no,
              duration_ms, rom_deg, form_score, errors, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientUuid,
              exerciseId,
              Number(rep.set_no ?? 1),
              Number(rep.rep_no ?? 1),
              Number(rep.duration_ms ?? 0),
              Number(rep.rom_deg ?? 0),
              Number(rep.form_score ?? 100),
              errorsStr,
              Number(rep.confidence ?? 1.0),
            ]
          );
        }
      }
    }

    return { client_uuid: clientUuid, synced: 0 };
  },

  /**
   * Retrieves all unsynced sessions (synced = 0) and reconstructs their full payloads.
   *
   * @returns {Promise<Array<object>>} Array of full SessionPayload objects
   */
  async getUnsyncedSessions() {
    const db = await getDatabase();
    const sessionRows = await db.getAllAsync(
      `SELECT * FROM sessions WHERE synced = 0 ORDER BY id ASC`
    );

    const payloads = [];

    for (const s of sessionRows) {
      const exerciseRows = await db.getAllAsync(
        `SELECT * FROM session_exercises WHERE session_client_uuid = ?`,
        [s.client_uuid]
      );

      const exercises = [];
      for (const ex of exerciseRows) {
        const repRows = await db.getAllAsync(
          `SELECT * FROM rep_events WHERE session_client_uuid = ? AND exercise_id = ? ORDER BY rep_no ASC`,
          [s.client_uuid, ex.exercise_id]
        );

        const reps = repRows.map(r => {
          let parsedErrors = [];
          try {
            parsedErrors = typeof r.errors === 'string' ? JSON.parse(r.errors) : r.errors;
          } catch {
            parsedErrors = [];
          }
          return {
            set_no: r.set_no,
            rep_no: r.rep_no,
            duration_ms: r.duration_ms,
            rom_deg: r.rom_deg,
            form_score: r.form_score,
            errors: parsedErrors,
            confidence: r.confidence,
          };
        });

        exercises.push({
          exercise_id: ex.exercise_id,
          sets_done: ex.sets_done,
          reps_done: ex.reps_done,
          avg_form_score: ex.avg_form_score,
          max_rom_deg: ex.max_rom_deg,
          avg_rom_deg: ex.avg_rom_deg,
          pain_before: ex.pain_before,
          pain_after: ex.pain_after,
          side: ex.side,
          reps,
        });
      }

      const payload = {
        client_uuid: s.client_uuid,
        started_at: s.started_at,
        ended_at: s.ended_at,
        pose_model_ver: s.pose_model_ver,
        app_version: s.app_version,
        overall_score: s.overall_score,
        exercises,
      };

      if (s.plan_id) {
        payload.plan_id = s.plan_id;
      }

      payloads.push(payload);
    }

    return payloads;
  },

  /**
   * Marks a session as synced = 1 in SQLite.
   *
   * @param {string} clientUuid
   * @returns {Promise<boolean>}
   */
  async markSessionSynced(clientUuid) {
    const db = await getDatabase();
    const syncedAt = new Date().toISOString();
    const res = await db.runAsync(
      `UPDATE sessions SET synced = 1, synced_at = ? WHERE client_uuid = ?`,
      [syncedAt, clientUuid]
    );
    return (res?.changes || 0) > 0;
  },

  /**
   * Gets the count of pending unsynced sessions.
   *
   * @returns {Promise<number>}
   */
  async getPendingCount() {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      `SELECT COUNT(*) AS count FROM sessions WHERE synced = 0`
    );
    return row?.count || 0;
  },

  /**
   * Caches active rehabilitation plan locally for offline usage.
   *
   * @param {object} planData
   */
  async cacheActivePlan(planData) {
    if (!planData) return;
    const db = await getDatabase();
    const jsonStr = JSON.stringify(planData);
    const cachedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_plans (plan_key, plan_json, cached_at) VALUES ('active_plan', ?, ?)`,
      [jsonStr, cachedAt]
    );
  },

  /**
   * Retrieves locally cached active rehabilitation plan.
   *
   * @returns {Promise<object|null>}
   */
  async getCachedActivePlan() {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      `SELECT plan_json FROM cached_plans WHERE plan_key = 'active_plan'`
    );
    if (!row?.plan_json) return null;
    try {
      return JSON.parse(row.plan_json);
    } catch {
      return null;
    }
  },
};

// Top-level export so LiveMonitor can directly call:
// import { saveSession } from '../db/sessionRepository';
export const saveSession = (payload) => sessionRepository.saveSession(payload);
