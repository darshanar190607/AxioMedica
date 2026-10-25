import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import { generateSpeech } from '../lib/tts';
import { COLORS, RADIUS, SHADOW } from '../data/theme';

export default function ReadAloudButton({ text, label = 'Listen', compact = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          // Ignored
        }
      }
      if (urlRef.current && typeof URL !== 'undefined') {
        URL.revokeObjectURL(urlRef.current);
      }
      Speech.stop();
    };
  }, []);

  async function handleListen() {
    if (!text || !text.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      // 1. Try FastAPI TTS service first
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }

        try {
          const blob = await generateSpeech(text);
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          const player = new Audio(url);
          audioRef.current = player;
          await player.play();
          setLoading(false);
          return;
        } catch (ttsErr) {
          // If backend TTS service is unavailable, gracefully fall back to native Expo Speech
          console.warn('Backend TTS service unreachable, falling back to expo-speech:', ttsErr.message);
        }
      }

      // 2. Fallback to native on-device expo-speech
      Speech.stop();
      Speech.speak(text, {
        rate: 0.95,
        pitch: 1.0,
        onDone: () => setLoading(false),
        onError: () => setLoading(false),
      });
      // In case onDone doesn't fire immediately
      setTimeout(() => setLoading(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not play audio.');
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, compact && styles.compactBtn, loading && styles.buttonDisabled]}
        onPress={handleListen}
        disabled={loading || !text?.trim()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Read text aloud"
      >
        {loading ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={COLORS.charcoal} />
            <Text style={styles.btnText}> Generating...</Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.icon}>🔊</Text>
            <Text style={styles.btnText}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  button: {
    backgroundColor: COLORS.cream || '#FAECB9',
    borderColor: COLORS.orange || '#EB9E29',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md || 16,
    alignSelf: 'flex-start',
    ...SHADOW,
  },
  compactBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm || 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 15,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.charcoal || '#141717',
  },
  errorText: {
    color: COLORS.stop || '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
});
