// 1. الأصغر: تفاصيل التمرين الأساسية
export interface ExerciseDto {
  id: string;
  name: string;
  description: string;
  muscleGroup: string;
  equipment: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  memberProfileId: string;
}

// 2. تمرين الجدول (يحتوي على الـ Sets والـ Reps ويستدعي الـ ExerciseDto)
export interface WorkoutExerciseDto {
  id: string;
  name: string;
  workoutDayId: string;
  exerciseId: string;
  exercise?: ExerciseDto | null; // أصبح معرفاً الآن لن يعطي خطأ
  sets: number;
  reps: number;
  muscleGroup?: string; 
  weight?: number | null;
  durationMinutes?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
}

// 3. اليوم (يحتوي على لستة من التمارين ويستدعي WorkoutExerciseDto)
export interface WorkoutDayDto {
  id: string;
  workoutPlanId: string;
  dayNumber?: number;
  dayName: string;
  exercises: WorkoutExerciseDto[]; // أصبح معرفاً الآن لن يعطي خطأ
}

// 4. الأكبر: الخطة بالكامل (تستدعي WorkoutDayDto المسمى days ليطابق الباك إند)
export interface WorkoutPlanDto {
  id: string;
  memberProfileId: string;
  assignedTrainerId?: string | null;
  name: string;
  durationWeeks: number;
  isActive: boolean;
  days: WorkoutDayDto[]; // أصبح معرفاً الآن لن يعطي خطأ
}