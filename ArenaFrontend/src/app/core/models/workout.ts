// 1. Smallest unit: Basic exercise details
export interface ExerciseDto {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  muscleGroup: string;
  muscleGroupAr?: string;
  equipment: string;
  equipmentAr?: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  primaryMuscles?: string | null;
  primaryMusclesAr?: string | null;
  secondaryMuscles?: string | null;
  secondaryMusclesAr?: string | null;
  instructions?: string | null;
  instructionsAr?: string | null;
  commonMistakes?: string | null;
  commonMistakesAr?: string | null;
  safetyTips?: string | null;
  safetyTipsAr?: string | null;
  breathing?: string | null;
  breathingAr?: string | null;
  difficulty?: string | null;
  difficultyAr?: string | null;
  category?: string | null;
  categoryAr?: string | null;
  memberProfileId: string;
}

// 2. Workout exercise (contains Sets, Reps and calls ExerciseDto)
export interface WorkoutExerciseDto {
  id: string;
  name: string;
  workoutDayId: string;
  exerciseId: string;
  exercise?: ExerciseDto | null;
  sets: number;
  reps: number;
  muscleGroup?: string; 
  weight?: number | null;
  durationMinutes?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
}

// 3. Day (contains a list of exercises and calls WorkoutExerciseDto)
export interface WorkoutDayDto {
  id: string;
  workoutPlanId: string;
  dayNumber?: number;
  dayName: string;
  exercises: WorkoutExerciseDto[];
}

// 4. Largest unit: The entire plan (calls WorkoutDayDto named days to match backend)
export interface WorkoutPlanDto {
  id: string;
  memberProfileId: string;
  assignedTrainerId?: string | null;
  name: string;
  durationWeeks: number;
  isActive: boolean;
  days: WorkoutDayDto[];
}