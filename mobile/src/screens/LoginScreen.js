import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import {
  Activity, Stethoscope, UserCheck, Mail, Lock,
  Eye, EyeOff, ShieldCheck, ArrowRight,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { PrimaryButton } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { isMockEnabled, setMockEnabled } from '../config/env';

export default function LoginScreen({ navigation }) {
  const { login, isLoading, error, clearError } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState('');

  const navigateByRole = (role) => {
    if (role === 'clinician') {
      navigation.replace('Clinician');
    } else {
      navigation.replace('Main');
    }
  };

  const handleLogin = async () => {
    clearError();
    setLocalError('');

    const targetEmail = (email || 'sarah.johnson@email.com').trim();
    const targetPassword = password || 'PatientPass123!';

    try {
      const res = await login(targetEmail, targetPassword);
      navigateByRole(res?.role);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('fetch') || msg.includes('Network') || msg.includes('NETWORK_ERROR') || msg.includes('Failed to fetch')) {
        setLocalError('Backend server is offline (http://localhost:8000). Click below to explore in Demo Mode!');
      } else {
        setLocalError(msg || 'Invalid email or password.');
      }
    }
  };

  const handleQuickPatient = async () => {
    clearError();
    setLocalError('');
    setEmail('sarah.johnson@email.com');
    setPassword('PatientPass123!');
    try {
      const res = await login('sarah.johnson@email.com', 'PatientPass123!');
      navigateByRole(res?.role || 'patient');
    } catch (err) {
      setMockEnabled(true);
      await login('sarah.johnson@email.com', 'PatientPass123!');
      navigation.replace('Main');
    }
  };

  const handleQuickClinician = async () => {
    clearError();
    setLocalError('');
    setEmail('doctor.torres@hospital.com');
    setPassword('ClinicianPass123!');
    try {
      const res = await login('doctor.torres@hospital.com', 'ClinicianPass123!');
      navigateByRole(res?.role || 'clinician');
    } catch (err) {
      setMockEnabled(true);
      await login('doctor.torres@hospital.com', 'ClinicianPass123!');
      navigation.replace('Clinician');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Brand */}
        <View style={s.brandArea}>
          <View style={s.logoMark}>
            <Activity size={28} color={COLORS.charcoal} />
          </View>
          <Text style={s.brandName}>AxioMedica</Text>
          <Text style={s.brandSub}>Clinical Ankle Biomechanics & Recovery</Text>
        </View>

        {/* 2 Roles Quick-Select Box */}
        <View style={s.roleCard}>
          <Text style={s.roleCardTitle}>Select Portal to Enter</Text>
          <Text style={s.roleCardSub}>Sign in directly to either platform workspace:</Text>

          <View style={s.roleBtnRow}>
            {/* Patient Button */}
            <TouchableOpacity
              style={[s.roleBtn, s.patientRoleBtn]}
              onPress={handleQuickPatient}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              <View style={s.roleBtnIconWrap}>
                <UserCheck size={20} color="#065F46" />
              </View>
              <View style={s.roleBtnTextWrap}>
                <Text style={s.roleBtnTitle}>Patient Portal</Text>
                <Text style={s.roleBtnSub}>Sarah Johnson · Stage 2</Text>
              </View>
              <Text style={s.roleBadge}>Patient</Text>
            </TouchableOpacity>

            {/* Clinician Button */}
            <TouchableOpacity
              style={[s.roleBtn, s.clinicianRoleBtn]}
              onPress={handleQuickClinician}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              <View style={[s.roleBtnIconWrap, { backgroundColor: '#E0E7FF' }]}>
                <Stethoscope size={20} color="#3730A3" />
              </View>
              <View style={s.roleBtnTextWrap}>
                <Text style={s.roleBtnTitle}>Clinician Portal</Text>
                <Text style={s.roleBtnSub}>Dr. Michael Torres · PT</Text>
              </View>
              <Text style={[s.roleBadge, s.clinicianBadge]}>Doctor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Manual Credentials Card */}
        <View style={s.card}>
          <Text style={s.welcome}>Account Credentials</Text>
          <Text style={s.sub}>Enter your medical credentials below</Text>

          {displayError ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <Text style={s.label}>Email Address</Text>
          <View style={s.inputWrap}>
            <Mail size={16} color={COLORS.mutedSage} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="sarah.johnson@email.com"
              placeholderTextColor={COLORS.mutedSage}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Password</Text>
          <View style={s.inputWrap}>
            <Lock size={16} color={COLORS.mutedSage} style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.mutedSage}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
              {showPass ? (
                <EyeOff size={16} color={COLORS.mutedSage} />
              ) : (
                <Eye size={16} color={COLORS.mutedSage} />
              )}
            </TouchableOpacity>
          </View>

          <View style={s.fillRow}>
            <TouchableOpacity onPress={() => { setEmail('sarah.johnson@email.com'); setPassword('PatientPass123!'); }}>
              <Text style={s.fillTag}>Fill Patient</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEmail('doctor.torres@hospital.com'); setPassword('ClinicianPass123!'); }}>
              <Text style={s.fillTag}>Fill Clinician</Text>
            </TouchableOpacity>
          </View>

          <PrimaryButton
            title={isLoading ? 'Signing In...' : 'Sign In'}
            onPress={handleLogin}
            disabled={isLoading}
          />
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.sage },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 44, paddingBottom: 32 },

  brandArea: { alignItems: 'center', marginBottom: 20 },
  logoMark: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    ...SHADOW_MD,
  },
  brandName: { fontSize: 22, fontWeight: '800', color: COLORS.charcoal },
  brandSub:  { fontSize: 13, color: COLORS.charcoal, opacity: 0.7, marginTop: 2 },

  /* 2 Roles Card */
  roleCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...SHADOW_MD,
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginBottom: 2,
  },
  roleCardSub: {
    fontSize: 12,
    color: COLORS.mutedSage,
    marginBottom: 12,
  },
  roleBtnRow: {
    gap: 10,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  patientRoleBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  clinicianRoleBtn: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  roleBtnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleBtnTextWrap: {
    flex: 1,
  },
  roleBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  roleBtnSub: {
    fontSize: 12,
    color: COLORS.mutedSage,
    marginTop: 1,
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  clinicianBadge: {
    color: '#3730A3',
    backgroundColor: '#E0E7FF',
  },

  /* Manual card */
  card: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW_MD,
  },
  welcome: { fontSize: 18, fontWeight: '800', color: COLORS.charcoal, marginBottom: 2 },
  sub:     { fontSize: 13, color: COLORS.mutedSage, marginBottom: 16 },

  errorBox: {
    backgroundColor: '#FDECEA',
    borderRadius: RADIUS.sm,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  errorText: {
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '600',
    textAlign: 'center',
  },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.charcoal, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, marginBottom: 12, height: 48,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, fontSize: 14, color: COLORS.charcoal },
  eyeBtn:    { padding: 6 },

  fillRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 16,
    marginTop: -4,
  },
  fillTag: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.orange,
    textDecorationLine: 'underline',
  },
});
