/**
 * mobile/src/engines/adapters/blazeposeAdapter.js
 * 
 * Pure JavaScript adapter for Google MediaPipe BlazePose TFLite output tensors.
 * Transforms raw neural network output tensors into canonical landmark objects.
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * - ZERO native imports (no react-native, vision-camera, or fast-tflite imports).
 * - Adapts to the existing AxioMedica landmark contract (docs/step1/04_landmark_schema.md).
 * - Does not modify or redesign downstream consumer modules.
 */

/**
 * Canonical 33 BlazePose landmark semantic keys in order (0 to 32).
 * Conforms strictly to docs/step1/04_landmark_schema.md and docs/contracts/pose_config.schema.json.
 */
export const BLAZEPOSE_KEYPOINT_NAMES = Object.freeze([
  'nose',              // 0
  'left_eye_inner',    // 1
  'left_eye',          // 2
  'left_eye_outer',    // 3
  'right_eye_inner',   // 4
  'right_eye',         // 5
  'right_eye_outer',   // 6
  'left_ear',          // 7
  'right_ear',         // 8
  'mouth_left',        // 9
  'mouth_right',       // 10
  'left_shoulder',     // 11
  'right_shoulder',    // 12
  'left_elbow',        // 13
  'right_elbow',       // 14
  'left_wrist',        // 15
  'right_wrist',       // 16
  'left_pinky',        // 17
  'right_pinky',       // 18
  'left_index',        // 19
  'right_index',       // 20
  'left_thumb',        // 21
  'right_thumb',       // 22
  'left_hip',          // 23
  'right_hip',         // 24
  'left_knee',         // 25
  'right_knee',        // 26
  'left_ankle',        // 27
  'right_ankle',       // 28
  'left_heel',         // 29
  'right_heel',        // 30
  'left_foot_index',   // 31
  'right_foot_index',  // 32
]);

export const TOTAL_CANONICAL_LANDMARKS = 33;
export const VALUES_PER_LANDMARK = 5; // x, y, z, visibility_logit, presence_logit
export const EXPECTED_RAW_TENSOR_LENGTH = 195; // 39 total keypoints * 5

/**
 * Numerically stable sigmoid function.
 * Maps raw model logits (-inf, +inf) to probability [0.0, 1.0].
 * 
 * @param {number} logit 
 * @returns {number} probability in [0.0, 1.0]
 */
export function sigmoid(logit) {
  if (typeof logit !== 'number' || isNaN(logit)) {
    return 0.0;
  }
  if (logit >= 40) return 1.0;
  if (logit <= -40) return 0.0;
  return 1.0 / (1.0 + Math.exp(-logit));
}

/**
 * Computes letterbox padding and scaling parameters if a rectangular camera
 * frame was resized and padded into the square 256x256 model input.
 * 
 * @param {number} frameWidth - Original camera frame width in pixels
 * @param {number} frameHeight - Original camera frame height in pixels
 * @param {number} [targetDim=256] - Model square input dimension
 * @returns {{ padX: number, padY: number, scaleX: number, scaleY: number }}
 */
export function computeLetterboxParams(frameWidth, frameHeight, targetDim = 256) {
  if (!frameWidth || !frameHeight || frameWidth <= 0 || frameHeight <= 0) {
    return { padX: 0, padY: 0, scaleX: 1.0, scaleY: 1.0 };
  }

  if (frameWidth === frameHeight) {
    return { padX: 0, padY: 0, scaleX: 1.0, scaleY: 1.0 };
  }

  // Portrait (width < height)
  if (frameWidth < frameHeight) {
    const scale = targetDim / frameHeight;
    const scaledW = frameWidth * scale;
    const padPixelsX = (targetDim - scaledW) / 2.0;
    return {
      padX: padPixelsX / targetDim,
      padY: 0,
      scaleX: scaledW / targetDim,
      scaleY: 1.0,
    };
  }

  // Landscape (width > height)
  const scale = targetDim / frameWidth;
  const scaledH = frameHeight * scale;
  const padPixelsY = (targetDim - scaledH) / 2.0;
  return {
    padX: 0,
    padY: padPixelsY / targetDim,
    scaleX: 1.0,
    scaleY: scaledH / targetDim,
  };
}

/**
 * Decodes raw BlazePose landmark output tensors into canonical AxioMedica landmarks.
 * 
 * @param {Array<number>|Float32Array|Array<Array<number>>} rawLandmarksTensor - Output tensor Identity [1, 195]
 * @param {Object} [options={}]
 * @param {number|Array<number>|Float32Array} [options.rawPresence] - Presence logit tensor Identity_1 [1, 1]
 * @param {number} [options.timestamp] - Acquisition timestamp in ms
 * @param {string} [options.source='camera'] - Source tag ('camera' | 'synthetic' | 'fixture')
 * @param {boolean} [options.isMirrored=false] - If true, inverts horizontal x: x' = 1.0 - x
 * @param {Object} [options.letterbox] - Letterbox compensation params { padX, padY, scaleX, scaleY }
 * @param {number} [options.presenceThreshold=0.5] - Min presence prob to report status='tracking'
 * @param {Array<number>|Float32Array} [options.rawWorldLandmarks] - Optional world 3D tensor Identity_4 [1, 117]
 * @returns {Object} Canonical landmark frame matching docs/step1/04_landmark_schema.md
 */
export function decodeBlazePoseTensors(rawLandmarksTensor, options = {}) {
  if (!rawLandmarksTensor) {
    throw new Error('rawLandmarksTensor is required');
  }

  // Handle batch dimension [1, 195] or flattened [195]
  let flatLandmarks = rawLandmarksTensor;
  if (Array.isArray(flatLandmarks) && flatLandmarks.length === 1 && (Array.isArray(flatLandmarks[0]) || ArrayBuffer.isView(flatLandmarks[0]))) {
    flatLandmarks = flatLandmarks[0];
  }

  if (!flatLandmarks || flatLandmarks.length < TOTAL_CANONICAL_LANDMARKS * VALUES_PER_LANDMARK) {
    throw new Error(
      `Invalid rawLandmarksTensor length: expected at least ${TOTAL_CANONICAL_LANDMARKS * VALUES_PER_LANDMARK}, got ${flatLandmarks ? flatLandmarks.length : 0}`
    );
  }

  const timestamp = typeof options.timestamp === 'number' ? options.timestamp : Date.now();
  const source = options.source || 'camera';
  const isMirrored = Boolean(options.isMirrored);
  const presenceThreshold = typeof options.presenceThreshold === 'number' ? options.presenceThreshold : 0.5;
  const letterbox = options.letterbox || null;

  // Evaluate presence logit if provided
  let presenceProb = 1.0;
  if (options.rawPresence !== undefined && options.rawPresence !== null) {
    let pVal = options.rawPresence;
    if (Array.isArray(pVal) || ArrayBuffer.isView(pVal)) {
      pVal = pVal[0];
    }
    presenceProb = sigmoid(Number(pVal));
  }

  const status = presenceProb >= presenceThreshold ? 'tracking' : 'lost';

  const landmarks = {};

  for (let i = 0; i < TOTAL_CANONICAL_LANDMARKS; i++) {
    const key = BLAZEPOSE_KEYPOINT_NAMES[i];
    const offset = i * VALUES_PER_LANDMARK;

    // BlazePose coordinates are in [0, 256] model pixel space
    let rawX = Number(flatLandmarks[offset + 0]);
    let rawY = Number(flatLandmarks[offset + 1]);
    let rawZ = Number(flatLandmarks[offset + 2]);
    const rawVis = Number(flatLandmarks[offset + 3]);

    // Normalize from [0, 256] to [0.0, 1.0]
    let normX = rawX / 256.0;
    let normY = rawY / 256.0;
    let normZ = rawZ / 256.0;

    // Compensate for letterbox padding if camera frame was aspect-scaled into square
    if (letterbox && letterbox.scaleX && letterbox.scaleY) {
      normX = (normX - (letterbox.padX || 0)) / letterbox.scaleX;
      normY = (normY - (letterbox.padY || 0)) / letterbox.scaleY;
    }

    // Clamp coordinates to [0.0, 1.0]
    normX = Math.max(0.0, Math.min(1.0, normX));
    normY = Math.max(0.0, Math.min(1.0, normY));

    // Handle horizontal mirroring (front camera)
    if (isMirrored) {
      normX = 1.0 - normX;
    }

    // Convert raw visibility logit to [0.0, 1.0] probability
    let visibility = sigmoid(rawVis);

    // Ensure within strict contract bounds [0, 1]
    visibility = Math.max(0.0, Math.min(1.0, visibility));

    landmarks[key] = {
      x: normX,
      y: normY,
      z: normZ,
      visibility,
    };
  }

  const frame = {
    timestamp,
    source,
    status,
    presence: presenceProb,
    landmarks,
  };

  // Optional: decode world 3D metric landmarks if provided [1, 117] (39 points * 3)
  if (options.rawWorldLandmarks) {
    let flatWorld = options.rawWorldLandmarks;
    if (Array.isArray(flatWorld) && flatWorld.length === 1 && (Array.isArray(flatWorld[0]) || ArrayBuffer.isView(flatWorld[0]))) {
      flatWorld = flatWorld[0];
    }
    if (flatWorld && flatWorld.length >= TOTAL_CANONICAL_LANDMARKS * 3) {
      const worldLandmarks = {};
      for (let i = 0; i < TOTAL_CANONICAL_LANDMARKS; i++) {
        const key = BLAZEPOSE_KEYPOINT_NAMES[i];
        const wOffset = i * 3;
        worldLandmarks[key] = {
          x: Number(flatWorld[wOffset + 0]),
          y: Number(flatWorld[wOffset + 1]),
          z: Number(flatWorld[wOffset + 2]),
        };
      }
      frame.worldLandmarks = worldLandmarks;
    }
  }

  return frame;
}
