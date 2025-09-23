import { Course, Room, Subject, Teacher } from '../types/timetable';

export interface DemoData {
  courses: Course[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Room[];
  settings: {
    collegeStart: string;
    collegeEnd: string;
    semesterParity: 'odd' | 'even' | '';
    theoryIntervalMinutes: number;
    labIntervalMinutes: number;
  };
}

export const generateDemoData = (): DemoData => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Larger set of departments/courses
  const courseDefs = [
    'CSE', 'ECE', 'IT', 'AIML', 'ME', 'CE', 'EEE', 'Chemical', 'BioTech', 'Physics', 'Mathematics', 'Chemistry', 'BBA', 'BCom', 'MBA', 'DataScience'
  ];

  const courses: Course[] = courseDefs.map((name, idx) => ({
    id: `course_demo_${idx}`,
    name,
    code: '',
    credits: 0,
    duration: 1,
    teacherId: '',
    studentsCount: 0,
    roomType: 'theory',
    requiredEquipment: [],
    sessionsPerWeek: 1,
    semester: 8,
    sections: ['A', 'B', 'C', 'D', 'E']
  }));

  // Subjects: ~5 per semester per course (mix of theory/lab)
  const subjects: Subject[] = [];
  const subjectPrefixes = ['Intro to', 'Advanced', 'Fundamentals of', 'Applied', 'Systems in'];
  const topicNames = ['Algorithms', 'Circuits', 'Thermodynamics', 'Structures', 'Databases', 'Networks', 'Analytics', 'Quantum', 'Optimization', 'Statistics'];
  courses.forEach(course => {
    for (let sem = 1; sem <= 8; sem++) {
      const perSem = 5;
      for (let i = 0; i < perSem; i++) {
        const type = (i % 4 === 3) ? 'lab' : 'theory'; // ~1 lab out of 4-5
        const topic = topicNames[(sem + i) % topicNames.length];
        const prefix = subjectPrefixes[(i + sem) % subjectPrefixes.length];
        const code = `${course.name}-${sem}${String(i + 1).padStart(2, '0')}`;
        subjects.push({
          id: `subject_demo_${course.id}_${sem}_${i}`,
          courseId: course.id,
          semester: sem,
          name: `${prefix} ${topic}`,
          code,
          type
        });
      }
    }
  });

  // Build teacher name pool
  const firstNames = ['Aarav','Vihaan','Aditya','Dhruv','Kabir','Ishaan','Arjun','Reyansh','Sai','Vivaan','Anaya','Diya','Ira','Myra','Aadhya','Kiara','Sara','Saanvi','Aarohi','Navya'];
  const lastNames = ['Sharma','Verma','Gupta','Mehta','Iyer','Menon','Kapoor','Rao','Reddy','Patel','Khan','Singh','Das','Bose','Nair','Pillai','Chatterjee','Mukherjee','Banerjee','Ghosh'];
  const totalTeachers = 120;
  const teachers: Teacher[] = Array.from({ length: totalTeachers }, (_, i) => {
    const fname = firstNames[i % firstNames.length];
    const lname = lastNames[(i * 3) % lastNames.length];
    const name = `${fname} ${lname}`;
    const dep = courses[i % courses.length];
    // Assign 6-10 subjects taught across department subjects
    const courseSubjects = subjects.filter(s => s.courseId === dep.id);
    const taughtPick: string[] = [];
    for (let k = 0; k < 8; k++) {
      const pick = courseSubjects[(i * 7 + k * 5) % courseSubjects.length];
      if (pick && !taughtPick.includes(pick.id)) taughtPick.push(pick.id);
    }
    return {
      id: `teacher_demo_${i}`,
      name,
      email: `${fname.toLowerCase()}.${lname.toLowerCase()}${i}@univ.edu`,
      subjects: [`Spec ${1 + (i % 5)}`],
      departmentCourseId: dep.id,
      taughtSubjectIds: taughtPick,
      availability: days.map(day => ({ day, timeSlots: [] })),
      maxHoursPerDay: 8,
      maxHoursPerWeek: 40
    } as Teacher;
  });

  // Rooms: more theory and lab rooms
  const rooms: Room[] = [];
  for (let num = 101; num <= 350; num++) {
    rooms.push({
      id: `room_${num}`,
      name: `R-${num}`,
      capacity: 60 + ((num % 3) * 20),
      type: num % 4 === 0 ? 'lab' : 'theory',
      equipment: []
    });
  }

  return {
    courses,
    subjects,
    teachers,
    rooms,
    settings: {
      collegeStart: '10:00',
      collegeEnd: '18:00',
      semesterParity: 'odd',
      theoryIntervalMinutes: 40,
      labIntervalMinutes: 120
    }
  };
};


