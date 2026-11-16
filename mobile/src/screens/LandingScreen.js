import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView,
} from 'react-native';
import {
  Activity, ShieldCheck, Stethoscope, ArrowRight,
  TrendingUp, CheckCircle2, UserCheck, Smartphone,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';

export default function LandingScreen({ navigation }) {
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Clinical Header / Brand */}
        <View style={s.header}>
          <View style={s.logoMark}>
            <Activity size={24} color={COLORS.charcoal} />
          </View>
          <View>
            <Text style={s.brandTitle}>AxioMedica</Text>
            <Text style={s.brandSub}>Clinical Ankle Biomechanics Platform</Text>
          </View>
        </View>

        {/* Real Clinical Telemetry Demonstration Card */}
        <View style={s.telemetryCard}>
          <View style={s.telemetryHeader}>
            <View style={s.statusPill}>
              <View style={s.statusDot} />
              <Text style={s.statusText}>LIVE TELEMETRY</Text>
            </View>
            <Text style={s.protocolTag}>ATFL Sprain Phase II</Text>
          </View>

          {/* Biomechanical Telemetry Grid */}
          <View style={s.metricsRow}>
            <View style={s.metricBox}>
              <Text style={s.metricVal}>24.5°</Text>
              <Text style={s.metricLabel}>Active Dorsiflexion</Text>
              <View style={s.metricBarWrap}>
                <View style={[s.metricBarFill, { width: '82%', backgroundColor: '#10B981' }]} />
              </View>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricVal}>98.2%</Text>
              <Text style={s.metricLabel}>Safe Range Compliance</Text>
              <View style={s.metricBarWrap}>
                <View style={[s.metricBarFill, { width: '98%', backgroundColor: '#38BDF8' }]} />
              </View>
            </View>
          </View>

          {/* Joint Kinematic Status */}
          <View style={s.kinematicRow}>
            <View style={s.kinematicItem}>
              <ShieldCheck size={16} color="#10B981" />
              <Text style={s.kinematicText}>Talocrural Joint: Stabilized</Text>
            </View>
            <View style={s.kinematicItem}>
              <TrendingUp size={16} color="#6366F1" />
              <Text style={s.kinematicText}>+14° ROM vs Week 1</Text>
            </View>
          </View>
        </View>

        {/* Value Proposition */}
        <View style={s.heroTextWrap}>
          <Text style={s.headline}>Evidence-Based Ankle Rehabilitation.</Text>
          <Text style={s.subHeadline}>
            Real-time computer vision kinematics, clinician plan management,
            and acoustic biofeedback for accelerated recovery.
          </Text>
        </View>

        {/* 2 Quick Portal Access Cards */}
        <View style={s.portalCardsSection}>
          {/* Patient Card */}
          <TouchableOpacity
            style={[s.portalCard, s.patientCard]}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.88}
          >
            <View style={s.portalCardIcon}>
              <UserCheck size={24} color="#065F46" />
            </View>
            <View style={s.portalCardContent}>
              <Text style={s.portalCardTitle}>Patient Portal</Text>
              <Text style={s.portalCardSub}>Guided exercises, live feedback & pain tracking</Text>
            </View>
            <ArrowRight size={20} color="#065F46" />
          </TouchableOpacity>

          {/* Clinician Card */}
          <TouchableOpacity
            style={[s.portalCard, s.clinicianCard]}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.88}
          >
            <View style={s.portalCardIcon}>
              <Stethoscope size={24} color="#3730A3" />
            </View>
            <View style={s.portalCardContent}>
              <Text style={s.portalCardTitle}>Clinician Portal</Text>
              <Text style={s.portalCardSub}>Patient roster, plan approval & compliance</Text>
            </View>
            <ArrowRight size={20} color="#3730A3" />
          </TouchableOpacity>
        </View>

        {/* Verified Clinical Protocol Badges */}
        <View style={s.badgesContainer}>
          <View style={s.badgeItem}>
            <CheckCircle2 size={14} color="#059669" />
            <Text style={s.badgeText}>HIPAA & Patient Consent Compliant</Text>
          </View>
          <View style={s.badgeItem}>
            <CheckCircle2 size={14} color="#059669" />
            <Text style={s.badgeText}>Real-Time Vision Joint Tracking</Text>
          </View>
          <View style={s.badgeItem}>
            <CheckCircle2 size={14} color="#059669" />
            <Text style={s.badgeText}>Integrated OmniVoice TTS Guidance</Text>
          </View>
        </View>

        {/* Main CTA */}
        <TouchableOpacity
          style={s.ctaButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.88}
        >
          <Text style={s.ctaButtonText}>Sign In to Your Portal</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sage,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 24,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.charcoal,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 12,
    color: COLORS.charcoal,
    opacity: 0.7,
    marginTop: 1,
  },

  /* Telemetry Card */
  telemetryCard: {
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    ...SHADOW_MD,
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  protocolTag: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 8,
  },
  metricBarWrap: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  kinematicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  kinematicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kinematicText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Hero Text */
  heroTextWrap: {
    marginBottom: 20,
  },
  headline: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.charcoal,
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 30,
  },
  subHeadline: {
    fontSize: 14,
    color: COLORS.charcoal,
    opacity: 0.75,
    lineHeight: 20,
  },

  /* 2 Portal Cards */
  portalCardsSection: {
    gap: 12,
    marginBottom: 20,
  },
  portalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    ...SHADOW,
  },
  patientCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  clinicianCard: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  portalCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    ...SHADOW,
  },
  portalCardContent: {
    flex: 1,
  },
  portalCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  portalCardSub: {
    fontSize: 12,
    color: COLORS.mutedSage,
    marginTop: 2,
  },

  /* Badges */
  badgesContainer: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.charcoal,
  },

  /* CTA Button */
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    gap: 10,
    ...SHADOW_MD,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
