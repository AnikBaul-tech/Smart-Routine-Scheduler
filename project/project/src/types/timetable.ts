export interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'theory' | 'lab';
  equipment: string[];
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  // Optional: department mapped to a course (by id)
  departmentCourseId?: string;
  // Optional: selected subjects (by Subject.id)
  taughtSubjectIds?: string[];
  availability: {
    day: string;
    timeSlots: string[];
  }[];
  maxHoursPerDay: number;
  maxHoursPerWeek: number;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  credits: number;
  duration: number; // in hours
  teacherId: string;
  studentsCount: number;
  roomType: 'theory' | 'lab';
  requiredEquipment: string[];
  sessionsPerWeek: number;
  // Optional: selected semester number for UI-driven workflows (1-8)
  semester?: number;
  // Optional: generated sections like ["A","B",...]
  sections?: string[];
}

export interface ClassSchedule {
  id: string;
  courseId: string;
  subjectId?: string;
  section?: string;
  semester?: number;
  teacherId: string;
  roomId: string;
  timeSlotId: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface TimetableConstraints {
  maxClassesPerDay: number;
  minBreakBetweenClasses: number; // in minutes
  preferredStartTime: string;
  preferredEndTime: string;
  avoidBackToBackClasses: boolean;
  balanceWorkload: boolean;
  // Optional: generate for odd or even semesters
  semesterParity?: 'odd' | 'even';
  theoryIntervalMinutes?: number;
  labIntervalMinutes?: number;
}

export interface Individual {
  schedule: ClassSchedule[];
  fitness: number;
}

export interface GeneticAlgorithmParams {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
}

export interface OptimizationResult {
  schedule: ClassSchedule[];
  fitness: number;
  conflicts: Conflict[];
  metrics: OptimizationMetrics;
  generationData: GenerationData[];
}

export interface Conflict {
  type: 'room_conflict' | 'teacher_conflict' | 'student_conflict' | 'constraint_violation';
  description: string;
  severity: 'high' | 'medium' | 'low';
  classes: string[];
}

export interface OptimizationMetrics {
  totalConflicts: number;
  roomUtilization: number;
  teacherWorkloadBalance: number;
  studentSatisfaction: number;
  constraintSatisfaction: number;
}

export interface GenerationData {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
}

// UI-focused type for managing subjects by course and semester
export interface Subject {
  id: string;
  courseId: string;
  semester: number; // 1-8
  name: string;
  code: string;
  type: 'theory' | 'lab';
}