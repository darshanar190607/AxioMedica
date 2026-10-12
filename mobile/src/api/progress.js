/**
 * mobile/src/api/progress.js
 * Progress metrics and pain logging endpoints.
 */
import { apiClient } from './client';

export const progressApi = {
  /**
   * Fetch aggregated progress summary: recovery stage, max ROM, adherence, pain avg.
   */
  async getProgressSummary() {
    return apiClient('/progress/summary', { method: 'GET' });
  },

  /**
   * Fetch time-series progress metrics (rom, adherence, pain, form_score).
   */
  async getProgressMetrics({ metric = 'rom', from, to } = {}) {
    const params = new URLSearchParams();
    if (metric) params.append('metric', metric);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString();
    const endpoint = query ? `/progress/metrics?${query}` : '/progress/metrics';
    return apiClient(endpoint, { method: 'GET' });
  },

  /**
   * Fetch patient pain logs.
   */
  async getPainLogs() {
    return apiClient('/pain-logs', { method: 'GET' });
  },

  /**
   * Record a new pain log.
   */
  async recordPainLog({ pain_level, body_part, notes }) {
    return apiClient('/pain-logs', {
      method: 'POST',
      body: { pain_level, body_part, notes },
    });
  },
};
