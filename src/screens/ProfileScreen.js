import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, TextInput, Modal,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { PrimaryButton, GhostButton } from '../components/UI';
import { patient, assignedExercises } from '../data/patientData';

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
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
  const [editModal, setEditModal] = useState(false);
  const [name,  setName]  = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone);
  const [email, setEmail] = useState(patient.email);

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
          <Text style={s.patientSub}>{patient.injuredAnkle} Ankle · Stage {patient.recoveryStage}</Text>
          <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)}>
            <Text style={s.editBtnText}>✏  Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <SectionCard title="Personal Information">
          <InfoRow label="Name"       value={name} />
          <InfoRow label="Age"        value={`${patient.age} years`} />
          <InfoRow label="Patient ID" value={patient.id} />
          <InfoRow label="Phone"      value={phone} />
          <InfoRow label="Email"      value={email} last />
        </SectionCard>

        <SectionCard title="Injury Information">
          <InfoRow label="Injured Ankle"  value={patient.injuredAnkle} />
          <InfoRow label="Injury Type"    value={patient.injuryType} />
          <InfoRow label="Recovery Stage" value={`Stage ${patient.recoveryStage}`} last />
        </SectionCard>

        <SectionCard title="Rehabilitation Plan">
          <InfoRow label="Plan Duration"      value={`${patient.totalWeeks} Weeks`} />
          <InfoRow label="Current Week"       value={`Week ${patient.currentWeek}`} />
          <InfoRow label="Assigned Exercises" value={assignedExercises.map(e => e.name).join(', ')} last />
        </SectionCard>

        <SectionCard title="Doctor Information">
          <InfoRow label="Doctor" value={patient.doctor.name} />
          <InfoRow label="Phone"  value={patient.doctor.phone} last />
        </SectionCard>

        <TouchableOpacity style={s.supportBtn}>
          <Text style={s.supportIcon}>❓</Text>
          <Text style={s.supportText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={() => navigation.replace('Landing')}>
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
              { label: 'Email', val: email, set: setEmail, type: 'email-address' },
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
            <PrimaryButton title="Save Changes" onPress={() => setEditModal(false)} style={{ marginTop: 8 }} />
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
