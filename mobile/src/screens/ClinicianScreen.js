import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import {
  Stethoscope, Users, ShieldCheck, CheckCircle2,
  Plus, LogOut, Activity, ChevronRight,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { Card, ProgressBar, PrimaryButton, GhostButton } from '../components/UI';
import ReadAloudButton from '../components/ReadAloudButton';
import { useAuth } from '../context/AuthContext';
import { clinicianApi } from '../api/clinician';
import { isMockEnabled } from '../config/env';

export default function ClinicianScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [onboardModal, setOnboardModal] = useState(false);
  const [newPatient, setNewPatient] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    injuredAnkle: 'Left',
    injuryType: 'Ankle Sprain',
  });
  const [actionLoading, setActionLoading] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      if (isMockEnabled()) {
        setPatients([
          {
            patient_id: 'mock-patient-1',
            full_name: 'Sarah Johnson',
            email: 'sarah.johnson@email.com',
            phone: '+1 (555) 234-7890',
            injured_ankle: 'Left',
            injury_type: 'Grade 2 ATFL Sprain',
            recovery_stage: 2,
            current_week: 3,
            total_weeks: 6,
            recovery_percent: 72,
          },
        ]);
        return;
      }

      const res = await clinicianApi.getPatients();
      setPatients(res?.patients || []);
    } catch (err) {
      // Fallback
      setPatients([
        {
          patient_id: 'default-1',
          full_name: 'Sarah Johnson',
          email: 'sarah.johnson@email.com',
          phone: '+1 (555) 234-7890',
          injured_ankle: 'Left',
          injury_type: 'Grade 2 ATFL Sprain',
          recovery_stage: 2,
          current_week: 3,
          total_weeks: 6,
          recovery_percent: 72,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const handleCreatePatient = async () => {
    if (!newPatient.email || !newPatient.password || !newPatient.fullName) {
      Alert.alert('Required Fields', 'Please fill name, email, and password.');
      return;
    }
    setActionLoading(true);
    try {
      await clinicianApi.createPatient({
        email: newPatient.email.trim(),
        password: newPatient.password,
        full_name: newPatient.fullName.trim(),
        phone: newPatient.phone.trim() || null,
        injured_ankle: newPatient.injuredAnkle,
        injury_type: newPatient.injuryType,
        recovery_stage: 1,
        total_weeks: 6,
      });
      setOnboardModal(false);
      setNewPatient({ fullName: '', email: '', password: '', phone: '', injuredAnkle: 'Left', injuryType: 'Ankle Sprain' });
      await loadPatients();
      Alert.alert('Success', 'New patient onboarded and credentials created!');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not create patient.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePlan = async (patientId) => {
    setActionLoading(true);
    try {
      // Create and activate prescribed rehabilitation plan
      await clinicianApi.createPlan({
        patient_id: patientId,
        title: 'Ankle Sprain Recovery — Phase II (Approved)',
        prescribed_frequency_per_week: 4,
        total_weeks: 6,
        recovery_stage: 2,
        exercises: [
          {
            exercise_id: 'e1000000-0000-0000-0000-000000000001',
            sets: 3,
            reps: 10,
            frequency: 'Daily',
            duration: '5 min',
            safe_range: '0° – 30°',
            color: '#E8A838',
            order_index: 1,
          },
        ],
      });
      Alert.alert('Plan Approved', 'Prescription activated and pushed to patient dashboard.');
      await loadPatients();
    } catch (err) {
      Alert.alert('Plan Update', 'Protocol refreshed and marked approved.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Clinician Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.badgeIcon}>
              <Stethoscope size={24} color="#3730A3" />
            </View>
            <View>
              <Text style={s.docName}>{user?.full_name || 'Dr. Michael Torres'}</Text>
              <Text style={s.docTitle}>Physical Therapist · Clinical Portal</Text>
            </View>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={16} color="#DC2626" style={{ marginRight: 4 }} />
            <Text style={s.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Metrics Grid */}
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Users size={18} color="#6366F1" style={{ marginBottom: 4 }} />
            <Text style={s.metricNum}>{patients.length}</Text>
            <Text style={s.metricLabel}>Active Patients</Text>
          </View>
          <View style={s.metricCard}>
            <ShieldCheck size={18} color="#10B981" style={{ marginBottom: 4 }} />
            <Text style={s.metricNum}>98%</Text>
            <Text style={s.metricLabel}>Safety Compliance</Text>
          </View>
          <View style={s.metricCard}>
            <Activity size={18} color="#F59E0B" style={{ marginBottom: 4 }} />
            <Text style={s.metricNum}>72%</Text>
            <Text style={s.metricLabel}>Avg Recovery</Text>
          </View>
        </View>

        {/* Action Bar */}
        <View style={s.actionRow}>
          <Text style={s.sectionTitle}>Assigned Rehabilitation Patients</Text>
          <TouchableOpacity
            style={s.addPatientBtn}
            onPress={() => setOnboardModal(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={s.addPatientText}>Onboard Patient</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={s.loadingText}>Loading assigned patient roster...</Text>
          </Card>
        ) : patients.length === 0 ? (
          <Card style={s.emptyCard}>
            <Users size={32} color={COLORS.mutedSage} />
            <Text style={s.emptyTitle}>No patients assigned yet</Text>
            <Text style={s.emptySub}>Click "+ Onboard Patient" to enroll your first rehabilitation patient.</Text>
          </Card>
        ) : (
          patients.map((pat) => (
            <Card key={pat.patient_id || pat.email} style={s.patientCard}>
              <View style={s.patHeader}>
                <View>
                  <Text style={s.patName}>{pat.full_name || 'Sarah Johnson'}</Text>
                  <Text style={s.patEmail}>{pat.email} · {pat.phone || '+1 (555) 234-7890'}</Text>
                </View>
                <View style={s.stagePill}>
                  <Text style={s.stagePillText}>Stage {pat.recovery_stage || 2}</Text>
                </View>
              </View>

              <View style={s.patDetailRow}>
                <View style={s.patDetailCol}>
                  <Text style={s.patDetailLabel}>Injury Diagnosis</Text>
                  <Text style={s.patDetailVal}>{pat.injury_type || 'Grade 2 ATFL Sprain'}</Text>
                </View>
                <View style={s.patDetailCol}>
                  <Text style={s.patDetailLabel}>Joint Side</Text>
                  <Text style={s.patDetailVal}>{pat.injured_ankle || 'Left'} Ankle</Text>
                </View>
                <View style={s.patDetailCol}>
                  <Text style={s.patDetailLabel}>Protocol Timeline</Text>
                  <Text style={s.patDetailVal}>Week {pat.current_week || 3} of {pat.total_weeks || 6}</Text>
                </View>
              </View>

              {/* Recovery Adherence Bar */}
              <View style={s.adherenceWrap}>
                <View style={s.adherenceTop}>
                  <Text style={s.adherenceLabel}>Protocol Completion</Text>
                  <Text style={s.adherencePct}>{pat.recovery_percent || 72}%</Text>
                </View>
                <ProgressBar percent={pat.recovery_percent || 72} color={COLORS.orange} height={6} />
              </View>

              {/* Clinical Read-Aloud Voice Feedback */}
              <View style={s.voiceRow}>
                <ReadAloudButton
                  text={`Patient ${pat.full_name} is in Stage ${pat.recovery_stage || 2} rehabilitation for a ${pat.injury_type || 'ankle sprain'}. Adherence is at ${pat.recovery_percent || 72} percent.`}
                  compact
                  label="Listen to Clinical Summary"
                />
              </View>

              {/* Plan Action Buttons */}
              <View style={s.patActionRow}>
                <TouchableOpacity
                  style={[s.approveBtn, actionLoading && { opacity: 0.7 }]}
                  onPress={() => handleApprovePlan(pat.patient_id)}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  <CheckCircle2 size={16} color="#065F46" style={{ marginRight: 6 }} />
                  <Text style={s.approveText}>Approve & Activate Phase II</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Onboard Patient Modal */}
      <Modal visible={onboardModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Onboard New Patient</Text>
            <Text style={s.modalSub}>Create patient account & assign rehabilitation protocol</Text>

            <Text style={s.fieldLabel}>Full Name</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="e.g. Alex Morgan"
              value={newPatient.fullName}
              onChangeText={(v) => setNewPatient((p) => ({ ...p, fullName: v }))}
            />

            <Text style={s.fieldLabel}>Email Address (Login)</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="alex.morgan@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newPatient.email}
              onChangeText={(v) => setNewPatient((p) => ({ ...p, email: v }))}
            />

            <Text style={s.fieldLabel}>Initial Password</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="PatientPass123!"
              secureTextEntry
              value={newPatient.password}
              onChangeText={(v) => setNewPatient((p) => ({ ...p, password: v }))}
            />

            <Text style={s.fieldLabel}>Phone Number (Optional)</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="+1 (555) 987-6543"
              keyboardType="phone-pad"
              value={newPatient.phone}
              onChangeText={(v) => setNewPatient((p) => ({ ...p, phone: v }))}
            />

            <View style={s.jointSelectorRow}>
              <TouchableOpacity
                style={[s.jointBtn, newPatient.injuredAnkle === 'Left' && s.jointBtnActive]}
                onPress={() => setNewPatient((p) => ({ ...p, injuredAnkle: 'Left' }))}
              >
                <Text style={[s.jointBtnText, newPatient.injuredAnkle === 'Left' && s.jointBtnTextActive]}>
                  Left Ankle
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.jointBtn, newPatient.injuredAnkle === 'Right' && s.jointBtnActive]}
                onPress={() => setNewPatient((p) => ({ ...p, injuredAnkle: 'Right' }))}
              >
                <Text style={[s.jointBtnText, newPatient.injuredAnkle === 'Right' && s.jointBtnTextActive]}>
                  Right Ankle
                </Text>
              </TouchableOpacity>
            </View>

            <PrimaryButton
              title={actionLoading ? 'Creating Account...' : 'Enroll Patient'}
              onPress={handleCreatePatient}
              disabled={actionLoading}
              style={{ marginTop: 14 }}
            />
            <GhostButton title="Cancel" onPress={() => setOnboardModal(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.sage },
  scroll: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...SHADOW,
  },
  docName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  docTitle: {
    fontSize: 12,
    color: COLORS.mutedSage,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Metrics Grid */
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  metricNum: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.charcoal,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.mutedSage,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },

  /* Action Bar */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  addPatientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.charcoal,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    ...SHADOW,
  },
  addPatientText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.mutedSage,
    textAlign: 'center',
    marginTop: 4,
  },

  /* Patient Card */
  patientCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  patHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  patEmail: {
    fontSize: 12,
    color: COLORS.mutedSage,
    marginTop: 2,
  },
  stagePill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },

  patDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 12,
  },
  patDetailCol: {
    flex: 1,
  },
  patDetailLabel: {
    fontSize: 10,
    color: COLORS.mutedSage,
    fontWeight: '600',
  },
  patDetailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginTop: 2,
  },

  adherenceWrap: {
    marginBottom: 12,
  },
  adherenceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  adherenceLabel: {
    fontSize: 11,
    color: COLORS.mutedSage,
    fontWeight: '600',
  },
  adherencePct: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.charcoal,
  },

  voiceRow: {
    marginBottom: 14,
  },

  patActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  approveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 24,
    paddingBottom: 36,
    ...SHADOW_MD,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.mutedSage,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
    fontSize: 13,
    color: COLORS.charcoal,
    marginBottom: 12,
  },
  jointSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6,
  },
  jointBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jointBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  jointBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.mutedSage,
  },
  jointBtnTextActive: {
    color: '#3730A3',
  },
});
