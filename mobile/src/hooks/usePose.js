/**
 * mobile/src/hooks/usePose.js
 * React hook wrapping the kinematic pose processing pipeline:
 * landmark smoothing, metric computation, rep counting, and calibration.
 */
import { useRef, useCallback, useState } from 'react';
import {
  getPoseConfigForExercise,
  KeypointSmoother,
  MetricEngine,
  RepCounter,
  CalibrationTracker,
} from '../pose';

export function usePose(exerciseName = 'Heel Raise', injuredSide = 'left') {
  const poseConfig = useRef(getPoseConfigForExercise(exerciseName)).current;
  const smootherRef = useRef(new KeypointSmoother());
  const metricEngineRef = useRef(new MetricEngine(poseConfig, injuredSide));
  const repCounterRef = useRef(new RepCounter(poseConfig));
  const calibrationRef = useRef(new CalibrationTracker(poseConfig, { minSamples: 10 }));

  const [metrics, setMetrics] = useState({
    ankle_angle: 90,
    knee_angle: 180,
    angular_velocity: 0,
    heel_height_delta: 0,
    rom_current_deg: 0,
  });
  const [repsDone, setRepsDone] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [formScore, setFormScore] = useState(100);
  const [lastCues, setLastCues] = useState([]);

  const processFrame = useCallback((rawLandmarks, timestamp = Date.now()) => {
    if (!rawLandmarks) return null;

    const smoothed = smootherRef.current.filter(rawLandmarks, timestamp);
    const calculatedMetrics = metricEngineRef.current.computeMetrics(smoothed);
    const confidence = metricEngineRef.current.calculateConfidence(smoothed);

    calibrationRef.current.addFrame(calculatedMetrics, confidence);
    const repRes = repCounterRef.current.processFrame(calculatedMetrics, confidence, timestamp);

    setMetrics(calculatedMetrics);
    setRepsDone(repRes.repsDone);
    if (repRes.cues?.length > 0) {
      setLastCues(repRes.cues);
    }
    if (repRes.completedRep) {
      setFormScore(repRes.completedRep.form_score ?? 100);
    }

    return {
      smoothed,
      metrics: calculatedMetrics,
      confidence,
      repResult: repRes,
    };
  }, []);

  const reset = useCallback(() => {
    smootherRef.current.reset();
    repCounterRef.current.reset();
    calibrationRef.current.reset();
    setRepsDone(0);
    setCurrentSet(1);
    setFormScore(100);
    setLastCues([]);
  }, []);

  return {
    poseConfig,
    metrics,
    repsDone,
    currentSet,
    formScore,
    lastCues,
    processFrame,
    reset,
    repCounter: repCounterRef.current,
    calibration: calibrationRef.current,
  };
}

export default usePose;
