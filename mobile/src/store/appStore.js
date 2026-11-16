/**
 * mobile/src/store/appStore.js
 * Lightweight global state management for application-wide notifications,
 * exercise state, and device telemetry.
 */
import { useState, useEffect } from 'react';

const listeners = new Set();
let globalState = {
  isOnline: true,
  activeExercise: null,
  activePlan: null,
  activePainScore: 0,
  syncPendingCount: 0,
};

function setGlobalState(updater) {
  globalState = typeof updater === 'function' ? updater(globalState) : { ...globalState, ...updater };
  listeners.forEach(fn => fn(globalState));
}

export function useAppStore(selector = state => state) {
  const [state, setState] = useState(() => selector(globalState));

  useEffect(() => {
    const handler = (next) => setState(selector(next));
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [selector]);

  return [state, setGlobalState];
}

export const getAppState = () => globalState;
export const updateAppState = setGlobalState;
