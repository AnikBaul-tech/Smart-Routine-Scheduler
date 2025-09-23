import { Individual, ClassSchedule, Course, Teacher, Room, TimeSlot, TimetableConstraints, Conflict, Subject } from '../types/timetable';

export interface ResourceAvailability {
  teacherOccupancy: Map<string, Set<string>>; // teacherId -> Set of "day_time" strings
  roomOccupancy: Map<string, Set<string>>; // roomId -> Set of "day_time" strings
}

export class GeneticAlgorithm {
  private courses: Course[];
  private teachers: Teacher[];
  private rooms: Room[];
  private timeSlots: TimeSlot[];
  private constraints: TimetableConstraints;
  private subjects: Subject[];

  constructor(
    courses: Course[],
    teachers: Teacher[],
    rooms: Room[],
    timeSlots: TimeSlot[],
    constraints: TimetableConstraints,
    subjects: Subject[] = []
  ) {
    this.courses = courses;
    this.teachers = teachers;
    this.rooms = rooms;
    this.timeSlots = timeSlots;
    this.constraints = constraints;
    this.subjects = subjects;
  }

  generateRandomIndividual(): Individual {
    const schedule: ClassSchedule[] = [];
    const availability = this.createResourceAvailability();

    // Generate actual course sessions from subjects and course sections
    const actualCourses = this.generateActualCourses();

    // Track teacher assignments per section to ensure diversity
    const sectionTeacherAssignments = new Map<string, Map<string, string>>(); // section -> subject -> teacher

    for (const actualCourse of actualCourses) {
      // Find teacher who can teach this subject
      const availableTeachers = this.teachers.filter(t => 
        t.taughtSubjectIds?.includes(actualCourse.subjectId) ||
        t.departmentCourseId === actualCourse.courseId
      );

      if (availableTeachers.length === 0) continue;

      // Ensure different teachers for different subjects in the same section
      const sectionKey = `${actualCourse.courseId}_${actualCourse.section}`;
      if (!sectionTeacherAssignments.has(sectionKey)) {
        sectionTeacherAssignments.set(sectionKey, new Map());
      }
      
      const sectionAssignments = sectionTeacherAssignments.get(sectionKey)!;
      
      // Filter out teachers already assigned to other subjects in this section
      const unassignedTeachers = availableTeachers.filter(teacher => 
        !Array.from(sectionAssignments.values()).includes(teacher.id)
      );
      
      // If all teachers are assigned, allow reuse but prefer different teachers
      const teachersToChooseFrom = unassignedTeachers.length > 0 ? unassignedTeachers : availableTeachers;
      
      const teacher = teachersToChooseFrom[Math.floor(Math.random() * teachersToChooseFrom.length)];
      
      // Record this assignment
      sectionAssignments.set(actualCourse.subjectId, teacher.id);
      
      // Find appropriate rooms
      const availableRooms = this.rooms.filter(room => 
        room.type === actualCourse.roomType && 
        room.capacity >= actualCourse.studentsCount
      );

      if (availableRooms.length === 0) continue;

      // Find available time slots
      const availableTimeSlots = this.timeSlots.filter(slot => {
        const timeKey = `${slot.day}_${slot.startTime}`;
        const teacherAvailable = !availability.teacherOccupancy.get(teacher.id)?.has(timeKey);
        const teacherInSchedule = teacher.availability.some(avail => 
          avail.day === slot.day && avail.timeSlots.includes(slot.id)
        );
        return teacherAvailable && teacherInSchedule;
      });

      if (availableTimeSlots.length === 0) continue;

      // Try to assign sessions
      for (let session = 0; session < actualCourse.sessionsPerWeek; session++) {
        const availableRoomsForSession = availableRooms.filter(room => {
          const timeSlot = availableTimeSlots[session % availableTimeSlots.length];
          const timeKey = `${timeSlot.day}_${timeSlot.startTime}`;
          return !availability.roomOccupancy.get(room.id)?.has(timeKey);
        });

        if (availableRoomsForSession.length === 0 || availableTimeSlots.length === 0) continue;

        const randomRoom = availableRoomsForSession[Math.floor(Math.random() * availableRoomsForSession.length)];
        const randomTimeSlot = availableTimeSlots[Math.floor(Math.random() * availableTimeSlots.length)];

        const timeKey = `${randomTimeSlot.day}_${randomTimeSlot.startTime}`;

        schedule.push({
          id: `${actualCourse.id}_${session}_${Date.now()}_${Math.random()}`,
          courseId: actualCourse.courseId,
          subjectId: actualCourse.subjectId,
          section: actualCourse.section,
          semester: actualCourse.semester,
          teacherId: teacher.id,
          roomId: randomRoom.id,
          timeSlotId: randomTimeSlot.id,
          day: randomTimeSlot.day,
          startTime: randomTimeSlot.startTime,
          endTime: randomTimeSlot.endTime
        });

        // Update availability
        if (!availability.teacherOccupancy.has(teacher.id)) {
          availability.teacherOccupancy.set(teacher.id, new Set());
        }
        if (!availability.roomOccupancy.has(randomRoom.id)) {
          availability.roomOccupancy.set(randomRoom.id, new Set());
        }
        availability.teacherOccupancy.get(teacher.id)!.add(timeKey);
        availability.roomOccupancy.get(randomRoom.id)!.add(timeKey);

        // Remove used time slot to prevent reuse
        availableTimeSlots.splice(availableTimeSlots.indexOf(randomTimeSlot), 1);
      }
    }

    return {
      schedule,
      fitness: this.calculateFitness(schedule)
    };
  }

  private createResourceAvailability(): ResourceAvailability {
    return {
      teacherOccupancy: new Map(),
      roomOccupancy: new Map()
    };
  }

  private generateActualCourses() {
    const actualCourses: Array<{
      id: string;
      courseId: string;
      subjectId: string;
      section: string;
      semester: number;
      roomType: 'theory' | 'lab';
      studentsCount: number;
      sessionsPerWeek: number;
    }> = [];

    for (const course of this.courses) {
      if (!course.sections || course.sections.length === 0) continue;

      for (const section of course.sections) {
        // Filter subjects by semester parity if specified
        const filteredSubjects = this.subjects.filter(subject => {
          if (subject.courseId !== course.id) return false;
          if (this.constraints.semesterParity === 'odd' && subject.semester % 2 === 0) return false;
          if (this.constraints.semesterParity === 'even' && subject.semester % 2 === 1) return false;
          return true;
        });

        for (const subject of filteredSubjects) {
          const sessionsPerWeek = subject.type === 'lab' ? 1 : 2; // Labs typically have 1 session, theory has 2
          
          actualCourses.push({
            id: `${course.id}_${subject.id}_${section}`,
            courseId: course.id,
            subjectId: subject.id,
            section,
            semester: subject.semester,
            roomType: subject.type === 'lab' ? 'lab' : 'theory',
            studentsCount: 60, // Default section size
            sessionsPerWeek
          });
        }
      }
    }

    return actualCourses;
  }

  calculateFitness(schedule: ClassSchedule[]): number {
    let fitness = 1000; // Start with base fitness
    const conflicts = this.detectConflicts(schedule);

    // Heavy penalty for hard constraints (conflicts)
    conflicts.forEach(conflict => {
      switch (conflict.severity) {
        case 'high':
          fitness -= 100; // Increased penalty for hard conflicts
          break;
        case 'medium':
          fitness -= 30;
          break;
        case 'low':
          fitness -= 10;
          break;
      }
    });

    // Reward balanced workload
    const workloadBalance = this.calculateWorkloadBalance(schedule);
    fitness += workloadBalance * 80;

    // Reward room utilization efficiency
    const roomUtilization = this.calculateRoomUtilization(schedule);
    fitness += roomUtilization * 60;

    // Reward time distribution (avoid clustering)
    const timeDistribution = this.calculateTimeDistribution(schedule);
    fitness += timeDistribution * 40;

    // Reward constraint satisfaction
    const constraintSatisfaction = this.calculateConstraintSatisfaction(schedule);
    fitness += constraintSatisfaction * 100;

    // Penalize gaps in schedule
    const gapPenalty = this.calculateGapPenalty(schedule);
    fitness -= gapPenalty * 20;

    // Reward coverage (all required classes scheduled)
    const coverage = this.calculateCoverage(schedule);
    fitness += coverage * 150;

    return Math.max(fitness, 0);
  }

  private calculateTimeDistribution(schedule: ClassSchedule[]): number {
    const timeSlotUsage = new Map<string, number>();
    
    schedule.forEach(cls => {
      const key = `${cls.day}_${cls.startTime}`;
      timeSlotUsage.set(key, (timeSlotUsage.get(key) || 0) + 1);
    });

    const usageCounts = Array.from(timeSlotUsage.values());
    if (usageCounts.length === 0) return 0;

    const mean = usageCounts.reduce((sum, count) => sum + count, 0) / usageCounts.length;
    const variance = usageCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / usageCounts.length;
    
    return Math.max(0, 1 - (variance / (mean || 1)));
  }

  private calculateConstraintSatisfaction(schedule: ClassSchedule[]): number {
    let satisfied = 0;
    let total = 0;

    schedule.forEach(cls => {
      total += 3; // 3 constraints per class

      // Teacher availability constraint
      const teacher = this.teachers.find(t => t.id === cls.teacherId);
      if (teacher?.availability.some(avail => 
        avail.day === cls.day && avail.timeSlots.some(slot => {
          const timeSlot = this.timeSlots.find(ts => ts.id === slot);
          return timeSlot && timeSlot.startTime === cls.startTime;
        })
      )) {
        satisfied++;
      }

      // Preferred time window constraint
      const startTime = new Date(`1970-01-01T${cls.startTime}`);
      const preferredStart = new Date(`1970-01-01T${this.constraints.preferredStartTime}`);
      const preferredEnd = new Date(`1970-01-01T${this.constraints.preferredEndTime}`);
      
      if (startTime >= preferredStart && startTime <= preferredEnd) {
        satisfied++;
      }

      // Room type constraint
      const room = this.rooms.find(r => r.id === cls.roomId);
      const subject = this.subjects.find(s => s.id === cls.subjectId);
      if (room && subject && room.type === (subject.type === 'lab' ? 'lab' : 'theory')) {
        satisfied++;
      }
    });

    return total > 0 ? satisfied / total : 0;
  }

  private calculateGapPenalty(schedule: ClassSchedule[]): number {
    const daySchedules = new Map<string, ClassSchedule[]>();
    
    schedule.forEach(cls => {
      const teacherDay = `${cls.teacherId}_${cls.day}`;
      if (!daySchedules.has(teacherDay)) {
        daySchedules.set(teacherDay, []);
      }
      daySchedules.get(teacherDay)!.push(cls);
    });

    let totalGaps = 0;
    
    daySchedules.forEach(classes => {
      classes.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      for (let i = 0; i < classes.length - 1; i++) {
        const current = classes[i];
        const next = classes[i + 1];
        
        const currentEnd = new Date(`1970-01-01T${current.endTime}`);
        const nextStart = new Date(`1970-01-01T${next.startTime}`);
        
        const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);
        
        if (gapMinutes > this.constraints.minBreakBetweenClasses + 60) { // More than 1 hour gap
          totalGaps += Math.floor(gapMinutes / 60);
        }
      }
    });

    return totalGaps;
  }

  private calculateCoverage(schedule: ClassSchedule[]): number {
    const actualCourses = this.generateActualCourses();
    const scheduledCourses = new Set(schedule.map(cls => 
      `${cls.courseId}_${cls.subjectId}_${cls.section}`
    ));

    let covered = 0;
    actualCourses.forEach(course => {
      if (scheduledCourses.has(course.id)) {
        covered++;
      }
    });

    return actualCourses.length > 0 ? covered / actualCourses.length : 0;
  }

  detectConflicts(schedule: ClassSchedule[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check for room conflicts (same room at same time)
    for (let i = 0; i < schedule.length; i++) {
      for (let j = i + 1; j < schedule.length; j++) {
        const class1 = schedule[i];
        const class2 = schedule[j];

        if (class1.roomId === class2.roomId && 
            class1.day === class2.day && 
            this.timeSlotsOverlap(class1, class2)) {
          conflicts.push({
            type: 'room_conflict',
            description: `Room ${class1.roomId} double-booked on ${class1.day}`,
            severity: 'high',
            classes: [class1.id, class2.id]
          });
        }

        // Check for teacher conflicts
        if (class1.teacherId === class2.teacherId && 
            class1.day === class2.day && 
            this.timeSlotsOverlap(class1, class2)) {
          conflicts.push({
            type: 'teacher_conflict',
            description: `Teacher ${class1.teacherId} double-booked on ${class1.day}`,
            severity: 'high',
            classes: [class1.id, class2.id]
          });
        }
      }
    }

    return conflicts;
  }

  private timeSlotsOverlap(class1: ClassSchedule, class2: ClassSchedule): boolean {
    const start1 = new Date(`1970-01-01T${class1.startTime}`);
    const end1 = new Date(`1970-01-01T${class1.endTime}`);
    const start2 = new Date(`1970-01-01T${class2.startTime}`);
    const end2 = new Date(`1970-01-01T${class2.endTime}`);

    return start1 < end2 && start2 < end1;
  }

  private calculateWorkloadBalance(schedule: ClassSchedule[]): number {
    const teacherWorkload: { [teacherId: string]: number } = {};
    
    schedule.forEach(cls => {
      teacherWorkload[cls.teacherId] = (teacherWorkload[cls.teacherId] || 0) + 1;
    });

    const workloads = Object.values(teacherWorkload);
    if (workloads.length === 0) return 0;

    const avg = workloads.reduce((sum, load) => sum + load, 0) / workloads.length;
    const variance = workloads.reduce((sum, load) => sum + Math.pow(load - avg, 2), 0) / workloads.length;
    
    return Math.max(0, 1 - (variance / (avg * avg || 1)));
  }

  private calculateRoomUtilization(schedule: ClassSchedule[]): number {
    const roomUsage: { [roomId: string]: number } = {};
    const totalSlots = this.timeSlots.length * 5; // 5 days

    schedule.forEach(cls => {
      roomUsage[cls.roomId] = (roomUsage[cls.roomId] || 0) + 1;
    });

    const utilizationRates = this.rooms.map(room => 
      (roomUsage[room.id] || 0) / totalSlots
    );

    return utilizationRates.reduce((sum, rate) => sum + rate, 0) / this.rooms.length;
  }

  crossover(parent1: Individual, parent2: Individual): Individual[] {
    // Use multiple crossover strategies
    const strategy = Math.random();
    
    if (strategy < 0.4) {
      return this.uniformCrossover(parent1, parent2);
    } else if (strategy < 0.7) {
      return this.twoPointCrossover(parent1, parent2);
    } else {
      return this.singlePointCrossover(parent1, parent2);
    }
  }

  private singlePointCrossover(parent1: Individual, parent2: Individual): Individual[] {
    const minLength = Math.min(parent1.schedule.length, parent2.schedule.length);
    if (minLength === 0) return [parent1, parent2];
    
    const crossoverPoint = Math.floor(Math.random() * minLength);
    
    const child1Schedule = [
      ...parent1.schedule.slice(0, crossoverPoint),
      ...parent2.schedule.slice(crossoverPoint)
    ];
    
    const child2Schedule = [
      ...parent2.schedule.slice(0, crossoverPoint),
      ...parent1.schedule.slice(crossoverPoint)
    ];

    return [
      { schedule: this.repairSchedule(child1Schedule), fitness: 0 },
      { schedule: this.repairSchedule(child2Schedule), fitness: 0 }
    ].map(child => ({
      ...child,
      fitness: this.calculateFitness(child.schedule)
    }));
  }

  private twoPointCrossover(parent1: Individual, parent2: Individual): Individual[] {
    const minLength = Math.min(parent1.schedule.length, parent2.schedule.length);
    if (minLength < 2) return this.singlePointCrossover(parent1, parent2);
    
    const point1 = Math.floor(Math.random() * minLength);
    const point2 = Math.floor(Math.random() * minLength);
    const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];
    
    const child1Schedule = [
      ...parent1.schedule.slice(0, start),
      ...parent2.schedule.slice(start, end),
      ...parent1.schedule.slice(end)
    ];
    
    const child2Schedule = [
      ...parent2.schedule.slice(0, start),
      ...parent1.schedule.slice(start, end),
      ...parent2.schedule.slice(end)
    ];

    return [
      { schedule: this.repairSchedule(child1Schedule), fitness: 0 },
      { schedule: this.repairSchedule(child2Schedule), fitness: 0 }
    ].map(child => ({
      ...child,
      fitness: this.calculateFitness(child.schedule)
    }));
  }

  private uniformCrossover(parent1: Individual, parent2: Individual): Individual[] {
    const maxLength = Math.max(parent1.schedule.length, parent2.schedule.length);
    const child1Schedule: ClassSchedule[] = [];
    const child2Schedule: ClassSchedule[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      const useParent1 = Math.random() < 0.5;
      
      if (useParent1 && i < parent1.schedule.length) {
        child1Schedule.push(parent1.schedule[i]);
      } else if (i < parent2.schedule.length) {
        child1Schedule.push(parent2.schedule[i]);
      }
      
      if (!useParent1 && i < parent1.schedule.length) {
        child2Schedule.push(parent1.schedule[i]);
      } else if (i < parent2.schedule.length) {
        child2Schedule.push(parent2.schedule[i]);
      }
    }

    return [
      { schedule: this.repairSchedule(child1Schedule), fitness: 0 },
      { schedule: this.repairSchedule(child2Schedule), fitness: 0 }
    ].map(child => ({
      ...child,
      fitness: this.calculateFitness(child.schedule)
    }));
  }

  private repairSchedule(schedule: ClassSchedule[]): ClassSchedule[] {
    const repairedSchedule: ClassSchedule[] = [];
    const usedSlots = new Set<string>();
    
    for (const classItem of schedule) {
      const slotKey = `${classItem.teacherId}_${classItem.roomId}_${classItem.day}_${classItem.startTime}`;
      
      if (!usedSlots.has(slotKey)) {
        // Check for conflicts and resolve
        const conflicts = this.detectConflictsForClass(classItem, repairedSchedule);
        if (conflicts.length === 0) {
          repairedSchedule.push(classItem);
          usedSlots.add(slotKey);
        } else {
          // Try to find alternative slot
          const repairedClass = this.findAlternativeSlot(classItem, repairedSchedule);
          if (repairedClass) {
            repairedSchedule.push(repairedClass);
            const newSlotKey = `${repairedClass.teacherId}_${repairedClass.roomId}_${repairedClass.day}_${repairedClass.startTime}`;
            usedSlots.add(newSlotKey);
          }
        }
      }
    }
    
    return repairedSchedule;
  }

  private detectConflictsForClass(classItem: ClassSchedule, existingSchedule: ClassSchedule[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    for (const existing of existingSchedule) {
      // Teacher conflict
      if (existing.teacherId === classItem.teacherId && 
          existing.day === classItem.day && 
          this.timeSlotsOverlap(existing, classItem)) {
        conflicts.push({
          type: 'teacher_conflict',
          description: `Teacher ${classItem.teacherId} conflict`,
          severity: 'high',
          classes: [existing.id, classItem.id]
        });
      }
      
      // Room conflict
      if (existing.roomId === classItem.roomId && 
          existing.day === classItem.day && 
          this.timeSlotsOverlap(existing, classItem)) {
        conflicts.push({
          type: 'room_conflict',
          description: `Room ${classItem.roomId} conflict`,
          severity: 'high',
          classes: [existing.id, classItem.id]
        });
      }
    }
    
    return conflicts;
  }

  private findAlternativeSlot(classItem: ClassSchedule, existingSchedule: ClassSchedule[]): ClassSchedule | null {
    const teacher = this.teachers.find(t => t.id === classItem.teacherId);
    if (!teacher) return null;

    for (const timeSlot of this.timeSlots) {
      // Check if teacher is available
      const teacherAvailable = teacher.availability.some(avail => 
        avail.day === timeSlot.day && avail.timeSlots.includes(timeSlot.id)
      );

      if (!teacherAvailable) continue;

      // Check for conflicts with existing schedule
      const testClass = {
        ...classItem,
        day: timeSlot.day,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        timeSlotId: timeSlot.id
      };

      const conflicts = this.detectConflictsForClass(testClass, existingSchedule);
      if (conflicts.length === 0) {
        return testClass;
      }
    }

    return null;
  }

  mutate(individual: Individual, mutationRate: number): Individual {
    const mutatedSchedule = [...individual.schedule];
    
    // Adaptive mutation based on fitness
    const adaptiveMutationRate = this.calculateAdaptiveMutationRate(individual.fitness, mutationRate);
    
    for (let i = 0; i < mutatedSchedule.length; i++) {
      if (Math.random() < adaptiveMutationRate) {
        const mutationType = Math.random();
        
        if (mutationType < 0.4) {
          // Time slot mutation
          this.mutateTimeSlot(mutatedSchedule[i]);
        } else if (mutationType < 0.7) {
          // Room mutation
          this.mutateRoom(mutatedSchedule[i]);
        } else if (mutationType < 0.9) {
          // Teacher mutation (if multiple teachers can teach the subject)
          this.mutateTeacher(mutatedSchedule[i]);
        } else {
          // Swap mutation (swap with another class)
          this.swapMutation(mutatedSchedule, i);
        }
      }
    }

    const repairedSchedule = this.repairSchedule(mutatedSchedule);
    return {
      schedule: repairedSchedule,
      fitness: this.calculateFitness(repairedSchedule)
    };
  }

  private calculateAdaptiveMutationRate(fitness: number, baseMutationRate: number): number {
    // Lower fitness = higher mutation rate to explore more
    const normalizedFitness = Math.max(0, Math.min(1, fitness / 1000));
    return baseMutationRate * (2 - normalizedFitness);
  }

  private mutateTimeSlot(classItem: ClassSchedule): void {
    const teacher = this.teachers.find(t => t.id === classItem.teacherId);
    if (!teacher) return;

    const availableTimeSlots = this.timeSlots.filter(slot => {
      return teacher.availability.some(avail => 
        avail.day === slot.day && avail.timeSlots.includes(slot.id)
      );
    });

    if (availableTimeSlots.length > 0) {
      const randomTimeSlot = availableTimeSlots[Math.floor(Math.random() * availableTimeSlots.length)];
      classItem.timeSlotId = randomTimeSlot.id;
      classItem.day = randomTimeSlot.day;
      classItem.startTime = randomTimeSlot.startTime;
      classItem.endTime = randomTimeSlot.endTime;
    }
  }

  private mutateRoom(classItem: ClassSchedule): void {
    const subject = this.subjects.find(s => s.id === classItem.subjectId);
    if (!subject) return;

    const availableRooms = this.rooms.filter(room => 
      room.type === (subject.type === 'lab' ? 'lab' : 'theory') &&
      room.capacity >= 60 // Default section size
    );

    if (availableRooms.length > 0) {
      const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
      classItem.roomId = randomRoom.id;
    }
  }

  private mutateTeacher(classItem: ClassSchedule): void {
    const availableTeachers = this.teachers.filter(t => 
      t.taughtSubjectIds?.includes(classItem.subjectId || '') ||
      t.departmentCourseId === classItem.courseId
    );

    if (availableTeachers.length > 1) { // Only mutate if there are alternatives
      const otherTeachers = availableTeachers.filter(t => t.id !== classItem.teacherId);
      
      if (otherTeachers.length > 0) {
        const randomTeacher = otherTeachers[Math.floor(Math.random() * otherTeachers.length)];
        classItem.teacherId = randomTeacher.id;
      }
    }
  }

  private swapMutation(schedule: ClassSchedule[], index: number): void {
    if (schedule.length < 2) return;
    
    const otherIndex = Math.floor(Math.random() * schedule.length);
    if (otherIndex !== index) {
      // Swap time slots and rooms between two classes
      const temp = {
        timeSlotId: schedule[index].timeSlotId,
        day: schedule[index].day,
        startTime: schedule[index].startTime,
        endTime: schedule[index].endTime,
        roomId: schedule[index].roomId
      };
      
      schedule[index].timeSlotId = schedule[otherIndex].timeSlotId;
      schedule[index].day = schedule[otherIndex].day;
      schedule[index].startTime = schedule[otherIndex].startTime;
      schedule[index].endTime = schedule[otherIndex].endTime;
      schedule[index].roomId = schedule[otherIndex].roomId;
      
      schedule[otherIndex].timeSlotId = temp.timeSlotId;
      schedule[otherIndex].day = temp.day;
      schedule[otherIndex].startTime = temp.startTime;
      schedule[otherIndex].endTime = temp.endTime;
      schedule[otherIndex].roomId = temp.roomId;
    }
  }

  selection(population: Individual[], eliteSize: number): Individual[] {
    // Sort by fitness (descending)
    population.sort((a, b) => b.fitness - a.fitness);
    
    // Select elite individuals
    const selected = population.slice(0, eliteSize);
    
    // Use both tournament and roulette wheel selection
    const halfRemaining = Math.floor((population.length - eliteSize) / 2);
    
    // Tournament selection for first half
    const tournamentSize = 3;
    for (let i = 0; i < halfRemaining; i++) {
      selected.push(this.tournamentSelection(population, tournamentSize));
    }
    
    // Roulette wheel selection for second half
    while (selected.length < population.length) {
      selected.push(this.rouletteWheelSelection(population));
    }

    return selected;
  }

  private tournamentSelection(population: Individual[], tournamentSize: number): Individual {
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      tournament.push(population[Math.floor(Math.random() * population.length)]);
    }
    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0];
  }

  private rouletteWheelSelection(population: Individual[]): Individual {
    // Normalize fitness scores to ensure they're positive
    const minFitness = Math.min(...population.map(ind => ind.fitness));
    const adjustedPopulation = population.map(ind => ({
      ...ind,
      fitness: ind.fitness - minFitness + 1 // Add 1 to avoid zero fitness
    }));

    const totalFitness = adjustedPopulation.reduce((sum, ind) => sum + ind.fitness, 0);
    const randomValue = Math.random() * totalFitness;
    
    let cumulativeFitness = 0;
    for (const individual of adjustedPopulation) {
      cumulativeFitness += individual.fitness;
      if (cumulativeFitness >= randomValue) {
        return individual;
      }
    }
    
    return adjustedPopulation[adjustedPopulation.length - 1];
  }
}