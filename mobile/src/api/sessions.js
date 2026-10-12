/**
 * mobile/src/api/sessions.js
 * Session sync and query endpoints.
 */
import { apiClient } from './client';

export const sessionsApi = {
  /**
   * Upload completed session with exercises & rep telemetry.
   * Backend is idempotent on client_uuid.
   *
   * @param {object} sessionPayload - adheres to session_payload.schema.json
   */
  async syncSession(sessionPayload) {
    return apiClient('/sessions/sync', {
      method: 'POST',
      body: sessionPayload,
    });
  },

  /**
   * Query sessions recorded by the patient within a date range.
   */
  async getSessions({ from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString();
    const endpoint = query ? `/sessions?${query}` : '/sessions';
    return apiClient(endpoint, { method: 'GET' });
  },

  /**
   * Retrieve single session detail with exercises and reps.
   */
  async getSessionById(id) {
    return apiClient(`/sessions/${id}`, { method: 'GET' });
  },
};
