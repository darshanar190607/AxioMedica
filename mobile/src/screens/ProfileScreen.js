import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import {
  User, Edit3, HelpCircle, LogOut, CheckCircle2,
  Stethoscope, Activity, Phone, Mail, Calendar,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { PrimaryButton, GhostButton } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { isMockEnabled } from '../config/env';
import { patient as mockPatient, assignedExercises as mockExercises } from '../data/patientData';

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={s.sectionCard}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { patient: authPatient, user: authUser, updatePatient, logout } = useAuth();
  const currentPatient = (!isMockEnabled() && authPatient) ? authPatient : mockPatient;

  const [editModal, setEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name,  setName]  = useState(currentPatient.full_name || currentPatient.name || 'Sarah Johnson');
  const [phone, setPhone] = useState(currentPatient.phone || '+1 555-019-2834');
  const [email, setEmail] = useState(authUser?.email || currentPatient.email || 'sarah.johnson@email.com');

  useEffect(() => {
    if (currentPatient) {
      setName(currentPatient.full_name || currentPatient.name || 'Sarah Johnson');
      setPhone(currentPatient.phone || '+1 555-019-2834');
      setEmail(authUser?.email || currentPatient.email || 'sarah.johnson@email.com');
    }
  }, [currentPatient, authUser]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (!isMockEnabled()) {
        await updatePatient({
          full_name: name.trim(),
          phone: phone.trim(),
        });
      }
      setEditModal(false);
      Alert.alert('Profile Saved', 'Your medical record details were successfully updated.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save profile updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const injuredAnkle = currentPatient.injured_ankle || currentPatient.injuredAnkle || 'Left';
  const injuryType = currentPatient.injury_type || currentPatient.injuryType || 'Grade 2 ATFL Sprain';
  const recoveryStage = currentPatient.recovery_stage ?? currentPatient.recoveryStage ?? 2;
  const totalWeeks = currentPatient.total_weeks ?? currentPatient.totalWeeks ?? 6;
  const currentWeek = currentPatient.current_week ?? currentPatient.currentWeek ?? 3;
  const patientId = currentPatient.id ? String(currentPatient.id).slice(0, 8).toUpperCase() : 'PT-2024';

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{name.split(' ').map(n => n[0]).join('')}</Text>
            </View>
          </View>
          <Text style={s.patientName}>{name}</Text>
          <Text style={s.patientSub}>{injuredAnkle} Ankle · Recovery Stage {recoveryStage}</Text>
          <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)} activeOpacity={0.8}>
            <Edit3 size={14} color={COLORS.charcoal} style={{ marginRight: 6 }} />
            <Text style={s.editBtnText}>Edit Clinical Profile</Text>
          </TouchableOpacity>
        </View>

        <SectionCard title="Personal Information">
          <InfoRow label="Name"       value={name} />
          <InfoRow label="Patient ID" value={patientId} />
          <InfoRow label="Phone"      value={phone} />
          <InfoRow label="Email"      value={email} last />
        </SectionCard>

        <SectionCard title="Clinical Diagnostics">
          <InfoRow label="Injured Joint"  value={`${injuredAnkle} Ankle`} />
          <InfoRow label="Pathology"      value={injuryType} />
          <InfoRow label="Stage"          value={`Stage ${recoveryStage} (Active Sub-Acute)`} last />
        </SectionCard>

        <SectionCard title="Rehabilitation Plan">
          <InfoRow label="Protocol Length"   value={`${totalWeeks} Weeks`} />
          <InfoRow label="Current Week"      value={`Week ${currentWeek}`} />
          <InfoRow label="Prescription"      value={mockExercises.map(e => e.name).join(', ')} last />
        </SectionCard>

        <SectionCard title="Attending Clinician">
          <InfoRow label="Physiotherapist" value="Dr. Michael Torres, PT" />
          <InfoRow label="Contact"         value="+1 (555) 987-3210" last />
        </SectionCard>

        <TouchableOpacity style={s.supportBtn} activeOpacity={0.8}>
          <HelpCircle size={18} color={COLORS.charcoal} style={{ marginRight: 10 }} />
          <Text style={s.supportText}>Clinical Support & FAQ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={18} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Update Profile</Text>
            <Text style={s.modalSub}>Changes will sync to your medical record</Text>

            <Text style={s.fieldLabel}>Full Legal Name</Text>
            <TextInput
              style={s.fieldInput}
              value={name}
              onChangeText={setName}
            />

            <Text style={s.fieldLabel}>Phone Number</Text>
            <TextInput
              style={s.fieldInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <PrimaryButton
              title={saving ? 'Updating Record...' : 'Save Changes'}
              onPress={handleSaveProfile}
              disabled={saving}
              style={{ marginTop: 12 }}
            />
            <GhostButton title="Cancel" onPress={() => setEditModal(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 20 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    ...SHADOW,
  },
  avatar: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: COLORS.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 26, fontWeight: '900', color: COLORS.charcoal },
  patientName: { fontSize: 20, fontWeight: '800', color: COLORS.charcoal },
  patientSub:  { fontSize: 13, color: COLORS.charcoal, opacity: 0.65, marginTop: 2, marginBottom: 12 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.charcoal },

  sectionCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.charcoal, marginBottom: 12 },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  infoLabel:     { fontSize: 13, color: COLORS.mutedSage, fontWeight: '500' },
  infoValue:     { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },

  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    paddingVertical: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  supportText: { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 13, fontWeight: '800', color: '#DC2626' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.charcoal },
  modalSub:   { fontSize: 12, color: COLORS.mutedSage, marginTop: 2, marginBottom: 16 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.charcoal, marginBottom: 6 },
  fieldInput: {
    backgroundColor: COLORS.cream, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, height: 44,
    fontSize: 14, color: COLORS.charcoal, marginBottom: 14,
  },
});
