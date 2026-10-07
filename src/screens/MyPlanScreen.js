import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar } from '../components/UI';
import ExerciseCard from '../components/ExerciseCard';
import { patient, assignedExercises } from '../data/patientData';

export default function MyPlanScreen({ navigation }) {
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>My Rehabilitation Plan</Text>

        {/* Plan summary card */}
        <View style={s.planCard}>
          <View style={s.planRow}>
            {[
              { val: `Stage ${patient.recoveryStage}`, label: 'Recovery Stage' },
              { val: `Wk ${patient.currentWeek}/${patient.totalWeeks}`, label: 'Current Week' },
              { val: `${patient.totalWeeks} Wks`, label: 'Total Duration' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.planItem}>
                  <Text style={s.planVal}>{item.val}</Text>
                  <Text style={s.planLabel}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.planDivider} />}
              </React.Fragment>
            ))}
          </View>
          <ProgressBar
            percent={(patient.currentWeek / patient.totalWeeks) * 100}
            color={COLORS.yellow}
            height={6}
            style={{ marginTop: 16 }}
          />
          <Text style={s.planSub}>
            {patient.currentWeek} of {patient.totalWeeks} weeks completed
          </Text>
        </View>

        {/* Section header */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Assigned Exercises</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>{assignedExercises.length}</Text>
          </View>
        </View>
        <Text style={s.note}>Assigned by {patient.doctor.name} for your recovery plan.</Text>

        {assignedExercises.map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            onPress={() => navigation.navigate('ExerciseDetail', { exercise: ex })}
          />
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16 },
  title:     { fontSize: 22, fontWeight: '800', color: COLORS.charcoal, marginBottom: 16 },

  planCard: {
    backgroundColor: COLORS.mint, borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 22, ...SHADOW_MD,
  },
  planRow:    { flexDirection: 'row', alignItems: 'center' },
  planItem:   { flex: 1, alignItems: 'center' },
  planVal:    { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  planLabel:  { fontSize: 10, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },
  planDivider:{ width: 1, height: 32, backgroundColor: 'rgba(20,23,23,0.15)' },
  planSub:    { fontSize: 11, color: COLORS.charcoal, opacity: 0.65, marginTop: 8, textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.charcoal },
  badge: {
    backgroundColor: COLORS.yellow, borderRadius: RADIUS.full,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: COLORS.charcoal },
  note: { fontSize: 12, color: COLORS.charcoal, opacity: 0.6, marginBottom: 14, lineHeight: 18 },
});
