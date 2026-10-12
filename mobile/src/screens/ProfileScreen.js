import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, TextInput, Modal, ActivityIndicator,
} from 'react-native';
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
          full_name: name,
          phone: phone,
        });
      }
      setEditModal(false);
    } catch {
      setEditModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Landing');
  };

  const injuredAnkle = currentPatient.injured_ankle || currentPatient.injuredAnkle || 'Right';
  const injuryType = currentPatient.injury_type || currentPatient.injuryType || 'Grade 2 ATFL Sprain';
  const recoveryStage = currentPatient.recovery_stage ?? currentPatient.recoveryStage ?? 2;
  const totalWeeks = currentPatient.total_weeks ?? currentPatient.totalWeeks ?? 8;
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
          <Text style={s.patientSub}>{injuredAnkle} Ankle · Stage {recoveryStage}</Text>
          <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)}>
            <Text style={s.editBtnText}>✏  Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <SectionCard title="Personal Information">
          <InfoRow label="Name"       value={name} />
          <InfoRow label="Patient ID" value={patientId} />
          <InfoRow label="Phone"      value={phone} />
          <InfoRow label="Email"      value={email} last />
        </SectionCard>

        <SectionCard title="Injury Information">
          <InfoRow label="Injured Ankle"  value={injuredAnkle} />
          <InfoRow label="Injury Type"    value={injuryType} />
          <InfoRow label="Recovery Stage" value={`Stage ${recoveryStage}`} last />
        </SectionCard>

        <SectionCard title="Rehabilitation Plan">
          <InfoRow label="Plan Duration"      value={`${totalWeeks} Weeks`} />
          <InfoRow label="Current Week"       value={`Week ${currentWeek}`} />
          <InfoRow label="Assigned Exercises" value={mockExercises.map(e => e.name).join(', ')} last />
        </SectionCard>

        <SectionCard title="Doctor Information">
          <InfoRow label="Doctor" value="Dr. Michael Torres" />
          <InfoRow label="Phone"  value="+1 (555) 987-3210" last />
        </SectionCard>

        <TouchableOpacity style={s.supportBtn}>
          <Text style={s.supportIcon}>❓</Text>
          <Text style={s.supportText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Edit Profile</Text>
            {[
              { label: 'Name',  val: name,  set: setName,  type: 'default' },
              { label: 'Phone', val: phone, set: setPhone, type: 'phone-pad' },
            ].map(f => (
              <View key={f.label}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={s.fieldInput}
                  value={f.val}
                  onChangeText={f.set}
                  keyboardType={f.type}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <PrimaryButton
              title={saving ? 'Saving...' : 'Save Changes'}
              onPress={handleSaveProfile}
              disabled={saving}
              style={{ marginTop: 8 }}
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
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16 },

  avatarSection: { alignItems: 'center', marginBottom: 22 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 3, borderColor: COLORS.offWhite,
    ...SHADOW_MD,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: COLORS.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 28, fontWeight: '800', color: COLORS.offWhite },
  patientName:  { fontSize: 20, fontWeight: '800', color: COLORS.charcoal },
  patientSub:   { fontSize: 12, color: COLORS.charcoal, opacity: 0.65, marginTop: 3, marginBottom: 12 },
  editBtn: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1.5, borderColor: COLORS.yellow,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.charcoal },

  sectionCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.charcoal, marginBottom: 10 },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  infoLabel:     { fontSize: 13, color: COLORS.mutedSage, flex: 1 },
  infoValue:     { fontSize: 13, fontWeight: '600', color: COLORS.charcoal, flex: 1.6, textAlign: 'right' },

  supportBtn: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  supportIcon: { fontSize: 16, marginRight: 8 },
  supportText: { fontSize: 14, fontWeight: '600', color: COLORS.charcoal },
  logoutBtn: {
    backgroundColor: '#FFF0EE', borderRadius: RADIUS.lg,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#FFD5D0',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: COLORS.stop },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.offWhite,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: COLORS.lightGray,
    borderRadius: 2, alignSelf: 'center', marginBottom: 18,
  },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.charcoal, marginBottom: 18 },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: COLORS.charcoal, marginBottom: 6 },
  fieldInput: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.charcoal, marginBottom: 14,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
  },
});
