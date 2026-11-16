/**
 * mobile/src/hooks/useCameraLandmarks.js
 *
 * Subscribes to the poseEngine singleton and exposes the latest landmark
 * frame + tracking status to consumers.
 *
 * PERFORMANCE INVARIANT:
 * - Does NOT call setState per frame for the raw landmark data.
 * - Exposes a ref (latestFrameRef) for overlay/skeleton drawing.
 * - Passes frame synchronously to onFrame callback if provided.
 * - Only calls setState for status and fps, throttled to <= 10 Hz.
 *
 * PRIVACY INVARIANT:
 * - Frames are never logged, persisted, or uploaded here.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { poseEngine } from '../engines/poseEngine';
import { evaluateTrackingQuality } from '../utils/trackingQuality';
import { getRequiredJoints } from '../utils/requiredJoints';

/**
 * @param {Object} [options]
 * @param {Function} [options.onFrame] - Synchronous callback for kinematic processing (no setState)
 * @param {string} [options.exerciseName] - Target exercise for required joints evaluation
 * @param {boolean} [options.enabled=true]
 * @returns {{
 *   latestFrameRef: React.MutableRefObject<object|null>,
 *   status: 'initializing'|'tracking'|'partial'|'lost',
 *   fps: number,
 *   guidance: string,
 * }}
 */
export function useCameraLandmarks({
  onFrame,
  exerciseName,
  enabled = true,
} = {}) {
  // Ref path for overlay & zero-alloc access
  const latestFrameRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const requiredJoints = getRequiredJoints(exerciseName);

  // Throttled state for HUD (<= 10 Hz)
  const [status, setStatus] = useState('initializing');
  const [fps, setFps] = useState(0);
  const [guidance, setGuidance] = useState('Positioning camera...');

  // FPS counter
  const frameCountRef = useRef(0);
  const fpsWindowRef = useRef(Date.now());
  const lastStatusUpdateRef = useRef(0);

  const handleFrame = useCallback((canonicalFrame) => {
    if (!enabled) return;

    latestFrameRef.current = canonicalFrame;
    frameCountRef.current += 1;

    // Direct synchronous call to downstream kinematic processor
    if (onFrameRef.current) {
      onFrameRef.current(canonicalFrame);
    }

    const now = Date.now();
    const elapsed = now - fpsWindowRef.current;

    // Throttle status + guidance + fps state updates to <= 10 Hz (100ms minimum)
    if (now - lastStatusUpdateRef.current >= 100) {
      lastStatusUpdateRef.current = now;

      const landmarks = canonicalFrame?.landmarks || canonicalFrame;
      const quality = evaluateTrackingQuality(landmarks, requiredJoints);

      // If poseEngine is lost or raw status is lost, mark lost
      const engineStatus = poseEngine.status;
      const resolvedStatus =
        engineStatus === 'lost' || canonicalFrame?.status === 'lost'
          ? 'lost'
          : quality.status;

      setStatus(resolvedStatus);
      setGuidance(quality.message);

      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        fpsWindowRef.current = now;
        setFps(currentFps);
      }
    }
  }, [enabled, requiredJoints]);

  useEffect(() => {
    if (!enabled) return;

    // Reset engine state when hook mounts
    poseEngine.reset();
    setStatus('initializing');

    const unsubscribe = poseEngine.subscribe(handleFrame);
    return () => {
      unsubscribe();
      latestFrameRef.current = null;
    };
  }, [enabled, handleFrame]);

  return {
    latestFrameRef,
    status,
    fps,
    guidance,
  };
}
