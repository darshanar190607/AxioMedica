import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';

export default function LandingScreen({ navigation }) {
  const a1  = useRef(new Animated.Value(0)).current;
  const a2  = useRef(new Animated.Value(0)).current;
  const a2y = useRef(new Animated.Value(24)).current;
  const a3  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(a1,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(a2,  { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(a2y, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
      Animated.timing(a3,  { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />

      {/* Logo */}
      <Animated.View style={[s.logoRow, { opacity: a1 }]}>
        <View style={s.logoMark}>
          <Text style={s.logoMarkText}>R</Text>
        </View>
        <Text style={s.logoLabel}>RehabStep AI</Text>
      </Animated.View>

      {/* Image card */}
      <Animated.View style={[s.imageWrap, { opacity: a2, transform: [{ translateY: a2y }] }]}>
        {/* Outer glow ring */}
        <View style={s.glowRing} />

        {/* Image circle */}
        <View style={s.imageCircle}>
          <Image
            source={require('../../ankel.jpg')}
            style={s.image}
            resizeMode="cover"
          />
        </View>

        {/* Overlay badges */}
        <View style={s.safeBadge}>
          <View style={s.safeDot} />
          <Text style={s.safeText}>SAFE ✓</Text>
        </View>

        <View style={s.aiBadge}>
          <Text style={s.aiText}>AI ✦</Text>
        </View>

        <View style={s.angleBadge}>
          <Text style={s.angleVal}>32°</Text>
          <Text style={s.angleLabel}>Range</Text>
        </View>
      </Animated.View>

      {/* Text block */}
      <Animated.View style={[s.textBlock, { opacity: a2, transform: [{ translateY: a2y }] }]}>
        <Text style={s.headline}>Recover Better.</Text>
        <Text style={s.headlineAccent}>Move Smarter.</Text>
        <Text style={s.body}>
          Your personalized AI companion for safer,{'\n'}smarter ankle rehabilitation.
        </Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[s.ctaBlock, { opacity: a3 }]}>
        <TouchableOpacity
          style={s.getStartedBtn}
          onPress={() => navigation.replace('Login')}
          activeOpacity={0.88}
        >
          <Text style={s.getStartedText}>Get Started</Text>
        </TouchableOpacity>
        <View style={s.pillRow}>
          {['Personalized', 'Guided', 'Progress Tracking'].map((p, i) => (
            <React.Fragment key={p}>
              <Text style={s.pillItem}>{p}</Text>
              {i < 2 && <Text style={s.pillDot}>·</Text>}
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 36,
    paddingHorizontal: 28,
  },

  /* Logo */
  logoRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  logoMark: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', marginRight: 9,
    ...SHADOW,
  },
  logoMarkText: { fontSize: 17, fontWeight: '900', color: COLORS.charcoal },
  logoLabel:    { fontSize: 17, fontWeight: '800', color: COLORS.charcoal },

  /* Image section */
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  glowRing: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: COLORS.mint,
    opacity: 0.45,
  },
  imageCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.offWhite,
    ...SHADOW_MD,
  },
  image: {
    width: '100%',
    height: '100%',
  },

  /* Overlay badges */
  safeBadge: {
    position: 'absolute',
    bottom: 14,
    left: 4,
    backgroundColor: COLORS.safe,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW,
  },
  safeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 5 },
  safeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  aiBadge: {
    position: 'absolute',
    top: 14,
    right: 4,
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...SHADOW,
  },
  aiText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  angleBadge: {
    position: 'absolute',
    bottom: 14,
    right: 4,
    backgroundColor: COLORS.yellow,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    ...SHADOW,
  },
  angleVal:   { fontSize: 13, fontWeight: '900', color: COLORS.charcoal },
  angleLabel: { fontSize: 9,  fontWeight: '600', color: COLORS.charcoal, opacity: 0.7 },

  /* Text */
  textBlock: { alignItems: 'center', paddingHorizontal: 4 },
  headline: {
    fontSize: 30, fontWeight: '900', color: COLORS.charcoal,
    textAlign: 'center', lineHeight: 36,
  },
  headlineAccent: {
    fontSize: 30, fontWeight: '900', color: COLORS.orange,
    textAlign: 'center', lineHeight: 36, marginBottom: 12,
  },
  body: {
    fontSize: 14, color: COLORS.charcoal, opacity: 0.72,
    textAlign: 'center', lineHeight: 22,
  },

  /* CTA */
  ctaBlock: { width: '100%', alignItems: 'center' },
  getStartedBtn: {
    width: '100%',
    backgroundColor: COLORS.yellow,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    ...SHADOW_MD,
  },
  getStartedText: { fontSize: 16, fontWeight: '800', color: COLORS.charcoal, letterSpacing: 0.3 },
  pillRow:  { flexDirection: 'row', alignItems: 'center' },
  pillItem: { fontSize: 12, color: COLORS.charcoal, opacity: 0.6, fontWeight: '500' },
  pillDot:  { fontSize: 12, color: COLORS.charcoal, opacity: 0.35, marginHorizontal: 6 },
});
