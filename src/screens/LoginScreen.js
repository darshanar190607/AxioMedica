import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { PrimaryButton } from '../components/UI';

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

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
            <Text style={s.logoMarkText}>R</Text>
          </View>
          <Text style={s.brandName}>RehabStep AI</Text>
          <Text style={s.brandSub}>Ankle Rehabilitation Platform</Text>
        </View>

        {/* Login card */}
        <View style={s.card}>
          <Text style={s.welcome}>Welcome Back 👋</Text>
          <Text style={s.sub}>Continue your recovery journey.</Text>

          <Text style={s.label}>Email Address</Text>
          <View style={s.inputWrap}>
            <Text style={s.inputIcon}>✉</Text>
            <TextInput
              style={s.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.mutedSage}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Password</Text>
          <View style={s.inputWrap}>
            <Text style={s.inputIcon}>🔒</Text>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.mutedSage}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
              <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.forgotRow}>
            <Text style={s.forgot}>Forgot Password?</Text>
          </TouchableOpacity>

          <PrimaryButton title="Login" onPress={() => navigation.replace('Main')} />

          <View style={s.divRow}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          <View style={s.signupRow}>
            <Text style={s.signupText}>Don't have an account? </Text>
            <TouchableOpacity>
              <Text style={s.signupLink}>Contact your provider</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.sage },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 52, paddingBottom: 32 },

  brandArea: { alignItems: 'center', marginBottom: 28 },
  logoMark: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    ...SHADOW_MD,
  },
  logoMarkText: { fontSize: 26, fontWeight: '900', color: COLORS.charcoal },
  brandName: { fontSize: 22, fontWeight: '800', color: COLORS.charcoal },
  brandSub:  { fontSize: 13, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },

  card: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW_MD,
  },
  welcome: { fontSize: 22, fontWeight: '800', color: COLORS.charcoal, marginBottom: 4 },
  sub:     { fontSize: 13, color: COLORS.mutedSage, marginBottom: 22 },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.charcoal, marginBottom: 7 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, marginBottom: 16, height: 50,
  },
  inputIcon: { fontSize: 15, marginRight: 10, color: COLORS.mutedSage },
  input:     { flex: 1, fontSize: 14, color: COLORS.charcoal },
  eyeBtn:    { padding: 4 },
  eyeIcon:   { fontSize: 16 },

  forgotRow: { alignItems: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgot:    { fontSize: 13, color: COLORS.orange, fontWeight: '600' },

  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divLine:{ flex: 1, height: 1, backgroundColor: COLORS.lightGray },
  divText:{ fontSize: 12, color: COLORS.mutedSage, marginHorizontal: 12 },

  signupRow:  { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  signupText: { fontSize: 13, color: COLORS.mutedSage },
  signupLink: { fontSize: 13, color: COLORS.orange, fontWeight: '700' },
});
