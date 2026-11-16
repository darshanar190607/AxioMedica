/**
 * mobile/src/lib/tts.js
 * Client utility to call the FastAPI TTS endpoint and retrieve the synthesized audio blob.
 */

// Default TTS service port is 8001 (or configured via EXPO_PUBLIC_TTS_URL)
const TTS_BASE_URL =
  process.env.EXPO_PUBLIC_TTS_URL ||
  (typeof window !== 'undefined' && window.location?.hostname
    ? `http://${window.location.hostname}:8001`
    : 'http://localhost:8001');

/**
 * Sends text to the TTS endpoint and returns an audio Blob.
 *
 * @param {string} text - text to read aloud
 * @returns {Promise<Blob>}
 */
export async function generateSpeech(text) {
  if (!text || !text.trim()) {
    throw new Error('Text to synthesize cannot be empty.');
  }

  const response = await fetch(`${TTS_BASE_URL}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? 'Unable to generate speech.');
  }

  return response.blob();
}

export default generateSpeech;
