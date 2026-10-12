/**
 * mobile/src/api/plans.js
 * Active Rehabilitation Plan and Exercise Catalog endpoints.
 */
import { apiClient } from './client';

export const plansApi = {
  /**
   * Fetch the current patient's active rehabilitation plan with exercises and pose_configs.
   */
  async getActivePlan() {
    return apiClient('/plans/active', { method: 'GET' });
  },

  /**
   * Fetch all exercises from the global catalog.
   */
  async getExercises() {
    return apiClient('/exercises', { method: 'GET' });
  },

  /**
   * Fetch a single exercise by ID with its pose_config.
   */
  async getExerciseById(id) {
    return apiClient(`/exercises/${id}`, { method: 'GET' });
  },
};
