/**
 * mobile/src/db/database.js
 * Local SQLite database initialization using modern Expo SDK 57 expo-sqlite API.
 * Includes schema creation for sessions, session_exercises, rep_events, and cached_plans.
 * Provides web and test memory fallback.
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

let _dbInstance = null;

// Memory fallback store for Web or Node.js test environments without native SQLite driver
class MemoryDatabase {
  constructor() {
    this.sessions = new Map();
    this.sessionExercises = [];
    this.repEvents = [];
    this.cachedPlans = new Map();
  }

  async execAsync(sql) {
    return;
  }

  async runAsync(sql, ...params) {
    const flattened = params.flat();
    const sqlUpper = sql.trim().toUpperCase();

    if (sqlUpper.includes('INSERT INTO SESSIONS')) {
      const [client_uuid, plan_id, started_at, ended_at, pose_model_ver, app_version, overall_score, created_at] = flattened;
      this.sessions.set(client_uuid, {
        client_uuid,
        plan_id: plan_id || null,
        started_at,
        ended_at,
        pose_model_ver,
        app_version,
        overall_score: Number(overall_score),
        synced: 0,
        created_at,
        synced_at: null,
      });
      return { lastInsertRowId: this.sessions.size, changes: 1 };
    }

    if (sqlUpper.includes('INSERT INTO SESSION_EXERCISES')) {
      const [session_client_uuid, exercise_id, sets_done, reps_done, avg_form_score, max_rom_deg, avg_rom_deg, pain_before, pain_after, side] = flattened;
      const row = {
        id: this.sessionExercises.length + 1,
        session_client_uuid,
        exercise_id: Number(exercise_id),
        sets_done: Number(sets_done),
        reps_done: Number(reps_done),
        avg_form_score: Number(avg_form_score),
        max_rom_deg: Number(max_rom_deg),
        avg_rom_deg: Number(avg_rom_deg),
        pain_before: Number(pain_before),
        pain_after: Number(pain_after),
        side,
      };
      this.sessionExercises.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }

    if (sqlUpper.includes('INSERT INTO REP_EVENTS')) {
      const [session_client_uuid, exercise_id, set_no, rep_no, duration_ms, rom_deg, form_score, errors, confidence] = flattened;
      const row = {
        id: this.repEvents.length + 1,
        session_client_uuid,
        exercise_id: Number(exercise_id),
        set_no: Number(set_no),
        rep_no: Number(rep_no),
        duration_ms: Number(duration_ms),
        rom_deg: Number(rom_deg),
        form_score: Number(form_score),
        errors: typeof errors === 'string' ? errors : JSON.stringify(errors || []),
        confidence: Number(confidence),
      };
      this.repEvents.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }

    if (sqlUpper.includes('UPDATE SESSIONS SET SYNCED = 1')) {
      const [synced_at, client_uuid] = flattened;
      const s = this.sessions.get(client_uuid);
      if (s) {
        s.synced = 1;
        s.synced_at = synced_at;
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sqlUpper.includes('INTO CACHED_PLANS')) {
      const plan_key = flattened.length >= 3 ? flattened[0] : 'active_plan';
      const plan_json = flattened.length >= 3 ? flattened[1] : flattened[0];
      const cached_at = flattened.length >= 3 ? flattened[2] : flattened[1];
      this.cachedPlans.set(plan_key, { plan_key, plan_json, cached_at });
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async getAllAsync(sql, ...params) {
    const flattened = params.flat();
    const sqlUpper = sql.trim().toUpperCase();

    if (sqlUpper.includes('FROM SESSIONS WHERE SYNCED = 0')) {
      return Array.from(this.sessions.values()).filter(s => s.synced === 0);
    }

    if (sqlUpper.includes('FROM SESSIONS WHERE SYNCED = 1')) {
      return Array.from(this.sessions.values()).filter(s => s.synced === 1);
    }

    if (sqlUpper.includes('FROM SESSIONS')) {
      return Array.from(this.sessions.values());
    }

    if (sqlUpper.includes('FROM SESSION_EXERCISES WHERE SESSION_CLIENT_UUID = ?')) {
      const [uuid] = flattened;
      return this.sessionExercises.filter(e => e.session_client_uuid === uuid);
    }

    if (sqlUpper.includes('FROM REP_EVENTS WHERE SESSION_CLIENT_UUID = ? AND EXERCISE_ID = ?')) {
      const [uuid, exId] = flattened;
      return this.repEvents.filter(r => r.session_client_uuid === uuid && r.exercise_id === Number(exId));
    }

    if (sqlUpper.includes('FROM REP_EVENTS WHERE SESSION_CLIENT_UUID = ?')) {
      const [uuid] = flattened;
      return this.repEvents.filter(r => r.session_client_uuid === uuid);
    }

    return [];
  }

  async getFirstAsync(sql, ...params) {
    const flattened = params.flat();
    const sqlUpper = sql.trim().toUpperCase();

    if (sqlUpper.includes('COUNT(*)') && sqlUpper.includes('SYNCED = 0')) {
      const count = Array.from(this.sessions.values()).filter(s => s.synced === 0).length;
      return { count };
    }

    if (sqlUpper.includes('FROM SESSIONS WHERE CLIENT_UUID')) {
      const [uuid] = flattened;
      return this.sessions.get(uuid) || null;
    }

    if (sqlUpper.includes('CACHED_PLANS')) {
      const key = flattened.length > 0 ? flattened[0] : 'active_plan';
      return this.cachedPlans.get(key) || null;
    }

    const rows = await this.getAllAsync(sql, ...params);
    return rows.length > 0 ? rows[0] : null;
  }
}

/**
 * Opens or retrieves the shared SQLite database instance.
 */
export async function getDatabase() {
  if (_dbInstance) {
    return _dbInstance;
  }

  // If in web environment or unit test environment where native sqlite is unavailable
  if (Platform.OS === 'web' || typeof jest !== 'undefined' || process.env.NODE_ENV === 'test') {
    _dbInstance = new MemoryDatabase();
    return _dbInstance;
  }

  try {
    const SQLite = require('expo-sqlite');
    _dbInstance = await SQLite.openDatabaseAsync('axiomedica.db');
    await initSchema(_dbInstance);
    return _dbInstance;
  } catch (err) {
    // Graceful fallback to memory database
    _dbInstance = new MemoryDatabase();
    return _dbInstance;
  }
}

/**
 * Initializes database tables and indices.
 */
export async function initSchema(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT UNIQUE NOT NULL,
      plan_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      pose_model_ver TEXT NOT NULL,
      app_version TEXT NOT NULL,
      overall_score REAL NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_synced ON sessions (synced);
    CREATE INDEX IF NOT EXISTS idx_sessions_client_uuid ON sessions (client_uuid);

    CREATE TABLE IF NOT EXISTS session_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_client_uuid TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      sets_done INTEGER NOT NULL,
      reps_done INTEGER NOT NULL,
      avg_form_score REAL NOT NULL,
      max_rom_deg REAL NOT NULL,
      avg_rom_deg REAL NOT NULL,
      pain_before INTEGER DEFAULT 0,
      pain_after INTEGER DEFAULT 0,
      side TEXT DEFAULT 'right',
      FOREIGN KEY (session_client_uuid) REFERENCES sessions (client_uuid) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_session_exercises_uuid ON session_exercises (session_client_uuid);

    CREATE TABLE IF NOT EXISTS rep_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_client_uuid TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_no INTEGER NOT NULL,
      rep_no INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      rom_deg REAL NOT NULL,
      form_score REAL NOT NULL,
      errors TEXT NOT NULL,
      confidence REAL NOT NULL,
      FOREIGN KEY (session_client_uuid) REFERENCES sessions (client_uuid) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rep_events_uuid ON rep_events (session_client_uuid);

    CREATE TABLE IF NOT EXISTS cached_plans (
      plan_key TEXT PRIMARY KEY NOT NULL,
      plan_json TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );
  `);
}

export function resetDatabaseInstance() {
  _dbInstance = null;
}
