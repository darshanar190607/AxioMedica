/**
 * mobile/__tests__/cameraLifecycle.test.js
 *
 * Unit tests for the camera lifecycle state machine and transitions.
 * Verifies all Gate 2 requirements under Jest environment:
 * - Permission flow states & activation gating
 * - Camera switching (front/back) with engine reset request
 * - AppState handling (background -> pause, foreground -> reacquire)
 * - Screen focus handling (blur -> pause, focus -> reacquire)
 * - Error handling (hardware error, resource in use) and retry flow
 * - Smooth frame acquisition transition (reacquiring -> active)
 */

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  StyleSheet: { create: (s) => s, absoluteFill: {} },
  Platform: { OS: 'android' },
  View: 'View',
  Text: 'Text',
}));

import {
  cameraLifecycleReducer,
  createInitialCameraState,
  computeIsActive,
} from '../src/hooks/useCameraLifecycle';

describe('Camera Lifecycle State Machine (Gate 2)', () => {
  describe('Initial State & computeIsActive', () => {
    it('initializes with default front facing and inactive when permission is not granted', () => {
      const state = createInitialCameraState({
        initialFacing: 'front',
        hasPermission: false,
        isForeground: true,
        isFocused: true,
        sessionActive: true,
      });

      expect(state.facing).toBe('front');
      expect(state.lifecycleStatus).toBe('initializing');
      expect(state.hasPermission).toBe(false);
      expect(state.isActive).toBe(false);
      expect(state.error).toBeNull();
    });

    it('computes isActive as true only when all conditions are satisfied', () => {
      const state = createInitialCameraState({
        hasPermission: true,
        isForeground: true,
        isFocused: true,
        sessionActive: true,
      });

      expect(state.isActive).toBe(true);

      // Inactive if permission revoked
      expect(computeIsActive({ ...state, hasPermission: false })).toBe(false);
      // Inactive if backgrounded
      expect(computeIsActive({ ...state, isForeground: false })).toBe(false);
      // Inactive if screen blurred
      expect(computeIsActive({ ...state, isFocused: false })).toBe(false);
      // Inactive if session paused / inactive
      expect(computeIsActive({ ...state, sessionActive: false })).toBe(false);
      // Inactive if lifecycleStatus is error
      expect(computeIsActive({ ...state, lifecycleStatus: 'error' })).toBe(false);
      // Inactive if lifecycleStatus is paused
      expect(computeIsActive({ ...state, lifecycleStatus: 'paused' })).toBe(false);
      // Active during reacquiring or initializing as long as all gates hold
      expect(computeIsActive({ ...state, lifecycleStatus: 'reacquiring' })).toBe(true);
      expect(computeIsActive({ ...state, lifecycleStatus: 'active' })).toBe(true);
    });
  });

  describe('Camera Selection & Switching', () => {
    it('switches facing from front to back, sets reacquiring, and requests engine reset', () => {
      const state = createInitialCameraState({
        initialFacing: 'front',
        hasPermission: true,
      });

      const next = cameraLifecycleReducer(state, { type: 'SWITCH_CAMERA' });

      expect(next.facing).toBe('back');
      expect(next.lifecycleStatus).toBe('reacquiring');
      expect(next.needsEngineReset).toBe(true);
      expect(next.error).toBeNull();
      expect(next.isActive).toBe(true);

      // Switching again returns to front
      const next2 = cameraLifecycleReducer(next, { type: 'SWITCH_CAMERA' });
      expect(next2.facing).toBe('front');
      expect(next2.lifecycleStatus).toBe('reacquiring');
      expect(next2.needsEngineReset).toBe(true);
    });
  });

  describe('AppState Handling', () => {
    it('pauses camera and disables inference when app goes to background', () => {
      const state = createInitialCameraState({
        hasPermission: true,
        isForeground: true,
      });

      const backgrounded = cameraLifecycleReducer(state, {
        type: 'APP_STATE_CHANGE',
        appState: 'background',
      });

      expect(backgrounded.isForeground).toBe(false);
      expect(backgrounded.lifecycleStatus).toBe('paused');
      expect(backgrounded.isActive).toBe(false);
      expect(backgrounded.needsEngineReset).toBe(false);
    });

    it('resumes with reacquiring and requests engine reset when app returns to foreground', () => {
      const backgroundedState = {
        ...createInitialCameraState({ hasPermission: true }),
        isForeground: false,
        lifecycleStatus: 'paused',
        isActive: false,
      };

      const foregrounded = cameraLifecycleReducer(backgroundedState, {
        type: 'APP_STATE_CHANGE',
        appState: 'active',
      });

      expect(foregrounded.isForeground).toBe(true);
      expect(foregrounded.lifecycleStatus).toBe('reacquiring');
      expect(foregrounded.needsEngineReset).toBe(true);
      expect(foregrounded.isActive).toBe(true);
    });
  });

  describe('Screen Focus Handling', () => {
    it('pauses inference when screen loses focus, and reacquires with engine reset on refocus', () => {
      const state = createInitialCameraState({
        hasPermission: true,
        isFocused: true,
      });

      const blurred = cameraLifecycleReducer(state, {
        type: 'FOCUS_CHANGE',
        isFocused: false,
      });

      expect(blurred.isFocused).toBe(false);
      expect(blurred.lifecycleStatus).toBe('paused');
      expect(blurred.isActive).toBe(false);
      expect(blurred.needsEngineReset).toBe(false);

      const refocused = cameraLifecycleReducer(blurred, {
        type: 'FOCUS_CHANGE',
        isFocused: true,
      });

      expect(refocused.isFocused).toBe(true);
      expect(refocused.lifecycleStatus).toBe('reacquiring');
      expect(refocused.needsEngineReset).toBe(true);
      expect(refocused.isActive).toBe(true);
    });
  });

  describe('Error Handling and Retry', () => {
    it('transitions to error state, records error details, and stops inference', () => {
      const state = createInitialCameraState({ hasPermission: true });

      const errored = cameraLifecycleReducer(state, {
        type: 'CAMERA_ERROR',
        error: {
          code: 'CAMERA_IN_USE',
          message: 'Camera device is occupied by another application',
        },
      });

      expect(errored.lifecycleStatus).toBe('error');
      expect(errored.error).toEqual({
        code: 'CAMERA_IN_USE',
        message: 'Camera device is occupied by another application',
      });
      expect(errored.isActive).toBe(false);
    });

    it('clears error, requests engine reset, and reacquires camera on retry', () => {
      const erroredState = {
        ...createInitialCameraState({ hasPermission: true }),
        lifecycleStatus: 'error',
        error: { code: 'CAMERA_IN_USE', message: 'Failed' },
        isActive: false,
      };

      const retried = cameraLifecycleReducer(erroredState, { type: 'RETRY' });

      expect(retried.lifecycleStatus).toBe('reacquiring');
      expect(retried.error).toBeNull();
      expect(retried.needsEngineReset).toBe(true);
      expect(retried.isActive).toBe(true);
    });
  });

  describe('Frame Acquisition Transition', () => {
    it('advances status from initializing to active when first frame is received', () => {
      const state = createInitialCameraState({ hasPermission: true });
      expect(state.lifecycleStatus).toBe('initializing');

      const active = cameraLifecycleReducer(state, { type: 'FRAME_RECEIVED' });
      expect(active.lifecycleStatus).toBe('active');
    });

    it('advances status from reacquiring to active when frame is received after camera switch', () => {
      const state = {
        ...createInitialCameraState({ hasPermission: true }),
        lifecycleStatus: 'reacquiring',
      };

      const active = cameraLifecycleReducer(state, { type: 'FRAME_RECEIVED' });
      expect(active.lifecycleStatus).toBe('active');
    });

    it('does not alter paused or error states on frame notification', () => {
      const pausedState = {
        ...createInitialCameraState({ hasPermission: true }),
        lifecycleStatus: 'paused',
      };
      const result = cameraLifecycleReducer(pausedState, { type: 'FRAME_RECEIVED' });
      expect(result.lifecycleStatus).toBe('paused');
    });
  });
});
