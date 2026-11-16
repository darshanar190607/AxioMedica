/**
 * mobile/src/hooks/useCameraLifecycle.js
 *
 * Camera lifecycle and state machine management hook & pure reducer.
 *
 * Enforces Gate 2 Requirements:
 * - Permission flow: undetermined -> request -> granted / denied ('Open Settings') / unavailable.
 * - Camera selection: 'front' | 'back' with switchCamera(); calls poseEngine.reset() on switch.
 * - Screen focus + AppState: camera inference stops when backgrounded or blurred,
 *   resumes with 'reacquiring' state when foregrounded and calls poseEngine.reset().
 * - Error handling: camera in use, hardware failure, retry UI action.
 */

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { poseEngine as defaultPoseEngine } from '../engines/poseEngine';
import { useVisionCameraPermission as defaultUsePermission } from '../engines/providers/visionCameraProvider';

/**
 * Pure helper to compute whether camera inference should be actively running.
 */
export function computeIsActive(state) {
  return (
    Boolean(state.hasPermission) &&
    Boolean(state.isForeground) &&
    Boolean(state.isFocused) &&
    Boolean(state.sessionActive) &&
    state.lifecycleStatus !== 'error' &&
    state.lifecycleStatus !== 'paused'
  );
}

/**
 * Initial state factory for camera lifecycle.
 */
export function createInitialCameraState({
  initialFacing = 'front',
  isFocused = true,
  sessionActive = true,
  hasPermission = false,
  isForeground = true,
} = {}) {
  const baseState = {
    facing: initialFacing,
    lifecycleStatus: 'initializing',
    error: null,
    isForeground,
    isFocused,
    hasPermission,
    sessionActive,
    needsEngineReset: false,
  };
  return {
    ...baseState,
    isActive: computeIsActive(baseState),
  };
}

/**
 * Pure state machine reducer for camera lifecycle transitions.
 */
export function cameraLifecycleReducer(state, action) {
  let nextState = { ...state, needsEngineReset: false };

  switch (action.type) {
    case 'SWITCH_CAMERA': {
      nextState.facing = state.facing === 'front' ? 'back' : 'front';
      nextState.lifecycleStatus = 'reacquiring';
      nextState.error = null;
      nextState.needsEngineReset = true;
      break;
    }

    case 'APP_STATE_CHANGE': {
      const isNowActive = action.appState === 'active';
      const wasForeground = state.isForeground;
      nextState.isForeground = isNowActive;

      if (wasForeground && !isNowActive) {
        // App went to background
        nextState.lifecycleStatus = 'paused';
      } else if (!wasForeground && isNowActive) {
        // App returned from background
        nextState.lifecycleStatus = 'reacquiring';
        nextState.needsEngineReset = true;
      }
      break;
    }

    case 'FOCUS_CHANGE': {
      const isFocused = action.isFocused;
      nextState.isFocused = isFocused;

      if (!isFocused) {
        nextState.lifecycleStatus = 'paused';
      } else if (state.isForeground) {
        nextState.lifecycleStatus = 'reacquiring';
        nextState.needsEngineReset = true;
      }
      break;
    }

    case 'CAMERA_ERROR': {
      nextState.error = {
        code: action.error?.code || 'CAMERA_ERROR',
        message: action.error?.message || 'Camera hardware failure or resource in use',
      };
      nextState.lifecycleStatus = 'error';
      break;
    }

    case 'RETRY': {
      nextState.error = null;
      nextState.lifecycleStatus = 'reacquiring';
      nextState.needsEngineReset = true;
      break;
    }

    case 'FRAME_RECEIVED': {
      if (state.lifecycleStatus === 'initializing' || state.lifecycleStatus === 'reacquiring') {
        nextState.lifecycleStatus = 'active';
      }
      break;
    }

    case 'PERMISSION_CHANGE': {
      nextState.hasPermission = Boolean(action.hasPermission);
      break;
    }

    case 'SESSION_ACTIVE_CHANGE': {
      nextState.sessionActive = Boolean(action.sessionActive);
      break;
    }

    default:
      return state;
  }

  nextState.isActive = computeIsActive(nextState);
  return nextState;
}

/**
 * React hook that wires the camera lifecycle state machine to system events.
 */
export function useCameraLifecycle({
  initialFacing = 'front',
  isFocused = true,
  sessionActive = true,
  poseEngineInstance = defaultPoseEngine,
  usePermissionHook = defaultUsePermission,
} = {}) {
  const perm = usePermissionHook();
  const hasPermission = Boolean(perm?.hasPermission);
  const initialForeground = (AppState.currentState || 'active') === 'active';

  const [state, dispatch] = useReducer(
    cameraLifecycleReducer,
    {
      initialFacing,
      isFocused,
      sessionActive,
      hasPermission,
      isForeground: initialForeground,
    },
    createInitialCameraState
  );

  // Synchronize permission changes
  useEffect(() => {
    dispatch({ type: 'PERMISSION_CHANGE', hasPermission });
  }, [hasPermission]);

  // Synchronize focus changes
  useEffect(() => {
    dispatch({ type: 'FOCUS_CHANGE', isFocused });
  }, [isFocused]);

  // Synchronize sessionActive changes
  useEffect(() => {
    dispatch({ type: 'SESSION_ACTIVE_CHANGE', sessionActive });
  }, [sessionActive]);

  // Execute poseEngine.reset whenever action demands it
  useEffect(() => {
    if (state.needsEngineReset && poseEngineInstance && typeof poseEngineInstance.reset === 'function') {
      poseEngineInstance.reset();
    }
  }, [state.needsEngineReset, poseEngineInstance]);

  // AppState subscription
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      dispatch({ type: 'APP_STATE_CHANGE', appState: nextAppState });
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

  // Action dispatches
  const switchCamera = useCallback(() => {
    dispatch({ type: 'SWITCH_CAMERA' });
  }, []);

  const handleCameraError = useCallback((err) => {
    dispatch({ type: 'CAMERA_ERROR', error: err });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' });
  }, []);

  const markFrameReceived = useCallback(() => {
    dispatch({ type: 'FRAME_RECEIVED' });
  }, []);

  return {
    facing: state.facing,
    lifecycleStatus: state.lifecycleStatus,
    error: state.error,
    isForeground: state.isForeground,
    isActive: state.isActive,
    switchCamera,
    handleCameraError,
    retry,
    markFrameReceived,
    permission: perm,
  };
}
