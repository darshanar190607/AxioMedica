/**
 * mobile/src/api/clinician.js
 * Clinician Portal endpoints for patient management and plan approval.
 */
import { apiClient } from './client';

export const clinicianApi = {
  /**
   * List all patients assigned to the authenticated clinician.
   */
  async getPatients() {
    return apiClient('/clinician/patients', { method: 'GET' });
  },

  /**
   * Clinician creates a new customized rehabilitation plan for a patient.
   */
  async createPlan(planData) {
    return apiClient('/clinician/plans', {
      method: 'POST',
      body: planData,
    });
  },

  /**
   * Clinician approves and activates a patient's rehabilitation plan.
   */
  async approvePlan(planId) {
    return apiClient(`/clinician/plans/${planId}/approve`, {
      method: 'PUT',
    });
  },

  /**
   * Onboard and register a new patient directly.
   */
  async createPatient(patientData) {
    return apiClient('/clinician/patients', {
      method: 'POST',
      body: patientData,
    });
  },
};

export default clinicianApi;
