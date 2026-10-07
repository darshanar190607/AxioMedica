export const patient = {
  id: 'PT-2024-0847',
  name: 'Sarah Johnson',
  age: 28,
  phone: '+1 (555) 234-7890',
  email: 'sarah.johnson@email.com',
  avatar: null,
  injuredAnkle: 'Left',
  injuryType: 'Ankle Sprain',
  recoveryStage: 2,
  currentWeek: 3,
  totalWeeks: 6,
  recoveryPercent: 72,
  doctor: {
    name: 'Dr. Michael Torres',
    phone: '+1 (555) 987-3210',
  },
};

export const assignedExercises = [
  {
    id: 'ex1',
    name: 'Dorsiflexion',
    sets: 3,
    reps: 10,
    frequency: 'Twice a day',
    progress: 80,
    completedSessions: 6,
    totalSessions: 8,
    completedReps: 54,
    totalReps: 80,
    duration: '5 min',
    description:
      'Slowly pull your toes upward toward your shin, hold for 2 seconds, then return to the starting position.',
    safeRange: '0° – 20°',
    color: '#F5C842',
  },
  {
    id: 'ex2',
    name: 'Plantarflexion',
    sets: 3,
    reps: 10,
    frequency: 'Twice a day',
    progress: 60,
    completedSessions: 4,
    totalSessions: 8,
    completedReps: 36,
    totalReps: 80,
    duration: '5 min',
    description:
      'Point your toes downward away from your shin, hold for 2 seconds, then return to the starting position.',
    safeRange: '0° – 30°',
    color: '#F5A623',
  },
  {
    id: 'ex3',
    name: 'Ankle Inversion',
    sets: 3,
    reps: 10,
    frequency: 'Once a day',
    progress: 50,
    completedSessions: 3,
    totalSessions: 8,
    completedReps: 27,
    totalReps: 80,
    duration: '4 min',
    description:
      'Gently turn your foot inward so the sole faces toward the other foot, hold for 2 seconds, then return.',
    safeRange: '0° – 15°',
    color: '#7EC8A4',
  },
  {
    id: 'ex4',
    name: 'Ankle Eversion',
    sets: 3,
    reps: 10,
    frequency: 'Once a day',
    progress: 40,
    completedSessions: 2,
    totalSessions: 8,
    completedReps: 18,
    totalReps: 80,
    duration: '4 min',
    description:
      'Gently turn your foot outward so the sole faces away from the other foot, hold for 2 seconds, then return.',
    safeRange: '0° – 15°',
    color: '#A8D5BA',
  },
];

export const sessionHistory = [
  { session: 'S1', score: 72 },
  { session: 'S2', score: 78 },
  { session: 'S3', score: 81 },
  { session: 'S4', score: 85 },
  { session: 'S5', score: 91 },
];

export const stats = {
  completedSessions: 12,
  totalReps: 86,
  accuracy: 91,
};
