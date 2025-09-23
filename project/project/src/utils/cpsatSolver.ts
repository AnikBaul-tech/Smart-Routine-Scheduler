import { ClassSchedule, Course, Teacher, Room, TimeSlot, TimetableConstraints, OptimizationResult, Conflict, OptimizationMetrics, Subject } from '../types/timetable';

interface Variable {
  id: string;
  courseId: string;
  subjectId: string;
  section: string;
  teacherId: string;
  roomId: string;
  timeSlotId: string;
  domain: boolean;
}

interface Constraint {
  id: string;
  type: 'resource_conflict' | 'teacher_availability' | 'room_capacity' | 'time_preference';
  variables: string[];
  satisfied: boolean;
}

export class CPSATSolver {
  private courses: Course[];
  private teachers: Teacher[];
  private rooms: Room[];
  private timeSlots: TimeSlot[];
  private constraints: TimetableConstraints;
  private subjects: Subject[];
  private variables: Map<string, Variable>;
  private constraintList: Constraint[];

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
    this.variables = new Map();
    this.constraintList = [];
  }

  async solve(): Promise<OptimizationResult> {
    // Initialize CSP variables and constraints
    this.initializeVariables();
    this.initializeConstraints();
    
    // Apply constraint propagation and arc consistency
    this.constraintPropagation();
    
    // Use backtracking search with intelligent heuristics
    const assignment = this.backtrackingSearch();
    
    if (assignment) {
      const schedule = this.assignmentToSchedule(assignment);
      const conflicts = this.detectConflicts(schedule);
      const metrics = this.calculateMetrics(schedule, conflicts);

      return {
        schedule,
        fitness: this.calculateFitness(schedule),
        conflicts,
        metrics,
        generationData: []
      };
    } else {
      // Fallback to relaxed constraint solving
      return this.solveWithRelaxedConstraints();
    }
  }

  private initializeVariables(): void {
    this.variables.clear();
    
    // Generate variables for each course-subject-section-teacher-room-time combination
    for (const course of this.courses) {
      if (!course.sections || course.sections.length === 0) continue;

      for (const section of course.sections) {
        const filteredSubjects = this.subjects.filter(subject => {
          if (subject.courseId !== course.id) return false;
          if (this.constraints.semesterParity === 'odd' && subject.semester % 2 === 0) return false;
          if (this.constraints.semesterParity === 'even' && subject.semester % 2 === 1) return false;
          return true;
        });

        for (const subject of filteredSubjects) {
          const availableTeachers = this.teachers.filter(t => 
            t.taughtSubjectIds?.includes(subject.id) ||
            t.departmentCourseId === course.id
          );

          const availableRooms = this.rooms.filter(room => 
            room.type === (subject.type === 'lab' ? 'lab' : 'theory') &&
            room.capacity >= 60
          );

          for (const teacher of availableTeachers) {
            for (const room of availableRooms) {
              for (const timeSlot of this.timeSlots) {
                const variableId = `${course.id}_${subject.id}_${section}_${teacher.id}_${room.id}_${timeSlot.id}`;
                
                this.variables.set(variableId, {
                  id: variableId,
                  courseId: course.id,
                  subjectId: subject.id,
                  section,
                  teacherId: teacher.id,
                  roomId: room.id,
                  timeSlotId: timeSlot.id,
                  domain: this.isVariableValid(course, subject, section, teacher, room, timeSlot)
                });
              }
            }
          }
        }
      }
    }
  }

  private isVariableValid(_course: Course, subject: Subject, _section: string, teacher: Teacher, room: Room, timeSlot: TimeSlot): boolean {
    // Check teacher availability
    const teacherAvailable = teacher.availability.some(avail => 
      avail.day === timeSlot.day && avail.timeSlots.includes(timeSlot.id)
    );

    // Check room type compatibility
    const roomCompatible = room.type === (subject.type === 'lab' ? 'lab' : 'theory');

    // Check time preferences
    const startTime = new Date(`1970-01-01T${timeSlot.startTime}`);
    const preferredStart = new Date(`1970-01-01T${this.constraints.preferredStartTime}`);
    const preferredEnd = new Date(`1970-01-01T${this.constraints.preferredEndTime}`);
    const timePreferred = startTime >= preferredStart && startTime <= preferredEnd;

    return teacherAvailable && roomCompatible && timePreferred;
  }

  private initializeConstraints(): void {
    this.constraintList = [];
    
    // Resource conflict constraints (no teacher/room double booking)
    this.addResourceConflictConstraints();
    
    // Subject requirement constraints (each subject must be scheduled)
    this.addSubjectRequirementConstraints();
    
    // Teacher diversity constraints (different teachers for different subjects in same section)
    this.addTeacherDiversityConstraints();
    
    // Workload balance constraints
    this.addWorkloadConstraints();
  }

  private addResourceConflictConstraints(): void {
    const timeSlotGroups = new Map<string, string[]>();
    
    // Group variables by time slot
    this.variables.forEach((variable, id) => {
      const key = `${variable.timeSlotId}`;
      if (!timeSlotGroups.has(key)) {
        timeSlotGroups.set(key, []);
      }
      timeSlotGroups.get(key)!.push(id);
    });

    // For each time slot, ensure no teacher/room conflicts
    timeSlotGroups.forEach((variableIds, timeSlotKey) => {
      // Teacher conflicts
      const teacherGroups = new Map<string, string[]>();
      variableIds.forEach(varId => {
        const variable = this.variables.get(varId)!;
        const teacherKey = variable.teacherId;
        if (!teacherGroups.has(teacherKey)) {
          teacherGroups.set(teacherKey, []);
        }
        teacherGroups.get(teacherKey)!.push(varId);
      });

      teacherGroups.forEach((vars, teacherId) => {
        if (vars.length > 1) {
          this.constraintList.push({
            id: `teacher_conflict_${teacherId}_${timeSlotKey}`,
            type: 'resource_conflict',
            variables: vars,
            satisfied: false
          });
        }
      });

      // Room conflicts
      const roomGroups = new Map<string, string[]>();
      variableIds.forEach(varId => {
        const variable = this.variables.get(varId)!;
        const roomKey = variable.roomId;
        if (!roomGroups.has(roomKey)) {
          roomGroups.set(roomKey, []);
        }
        roomGroups.get(roomKey)!.push(varId);
      });

      roomGroups.forEach((vars, roomId) => {
        if (vars.length > 1) {
          this.constraintList.push({
            id: `room_conflict_${roomId}_${timeSlotKey}`,
            type: 'resource_conflict',
            variables: vars,
            satisfied: false
          });
        }
      });
    });
  }

  private addSubjectRequirementConstraints(): void {
    // Each subject-section combination must be scheduled
    const subjectSectionGroups = new Map<string, string[]>();
    
    this.variables.forEach((variable, id) => {
      const key = `${variable.subjectId}_${variable.section}`;
      if (!subjectSectionGroups.has(key)) {
        subjectSectionGroups.set(key, []);
      }
      subjectSectionGroups.get(key)!.push(id);
    });

    subjectSectionGroups.forEach((variableIds, key) => {
      this.constraintList.push({
        id: `subject_requirement_${key}`,
        type: 'teacher_availability',
        variables: variableIds,
        satisfied: false
      });
    });
  }

  private addTeacherDiversityConstraints(): void {
    // Group variables by course-section to ensure different teachers for different subjects
    const sectionGroups = new Map<string, string[]>();
    
    this.variables.forEach((variable, id) => {
      const key = `${variable.courseId}_${variable.section}`;
      if (!sectionGroups.has(key)) {
        sectionGroups.set(key, []);
      }
      sectionGroups.get(key)!.push(id);
    });

    // For each section, ensure different teachers for different subjects
    sectionGroups.forEach((variableIds, sectionKey) => {
      const subjectTeacherPairs = new Map<string, Set<string>>(); // subject -> teachers
      
      variableIds.forEach(varId => {
        const variable = this.variables.get(varId)!;
        const subjectKey = variable.subjectId;
        if (!subjectTeacherPairs.has(subjectKey)) {
          subjectTeacherPairs.set(subjectKey, new Set());
        }
        subjectTeacherPairs.get(subjectKey)!.add(variable.teacherId);
      });

      // Create constraints to prefer different teachers for different subjects
      const subjects = Array.from(subjectTeacherPairs.keys());
      for (let i = 0; i < subjects.length; i++) {
        for (let j = i + 1; j < subjects.length; j++) {
          const subject1 = subjects[i];
          const subject2 = subjects[j];
          const teachers1 = subjectTeacherPairs.get(subject1)!;
          const teachers2 = subjectTeacherPairs.get(subject2)!;
          
          // Find common teachers (these should be avoided)
          const commonTeachers = new Set([...teachers1].filter(t => teachers2.has(t)));
          
          if (commonTeachers.size > 0) {
            // Add constraint to discourage using same teacher for different subjects
            const conflictingVars = variableIds.filter(varId => {
              const variable = this.variables.get(varId)!;
              return (variable.subjectId === subject1 || variable.subjectId === subject2) &&
                     commonTeachers.has(variable.teacherId);
            });
            
            if (conflictingVars.length > 0) {
              this.constraintList.push({
                id: `teacher_diversity_${sectionKey}_${subject1}_${subject2}`,
                type: 'resource_conflict',
                variables: conflictingVars,
                satisfied: false
              });
            }
          }
        }
      }
    });
  }

  private addWorkloadConstraints(): void {
    // Ensure balanced teacher workload
    const teacherGroups = new Map<string, string[]>();
    
    this.variables.forEach((variable, id) => {
      const key = variable.teacherId;
      if (!teacherGroups.has(key)) {
        teacherGroups.set(key, []);
      }
      teacherGroups.get(key)!.push(id);
    });

    teacherGroups.forEach((variableIds, teacherId) => {
      this.constraintList.push({
        id: `workload_${teacherId}`,
        type: 'teacher_availability',
        variables: variableIds,
        satisfied: false
      });
    });
  }

  private constraintPropagation(): void {
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const constraint of this.constraintList) {
        if (this.propagateConstraint(constraint)) {
          changed = true;
        }
      }

      // Remove inconsistent variables
      this.variables.forEach((variable, id) => {
        if (!variable.domain) {
          this.variables.delete(id);
          changed = true;
        }
      });
    }
  }

  private propagateConstraint(constraint: Constraint): boolean {
    let changed = false;

    if (constraint.type === 'resource_conflict') {
      // For resource conflicts, at most one variable can be true
      const activeVariables = constraint.variables.filter(id => 
        this.variables.has(id) && this.variables.get(id)!.domain
      );

      if (activeVariables.length === 1) {
        constraint.satisfied = true;
        // Disable conflicting variables
        constraint.variables.forEach(varId => {
          if (varId !== activeVariables[0] && this.variables.has(varId)) {
            this.variables.get(varId)!.domain = false;
            changed = true;
          }
        });
      }
    }

    return changed;
  }

  private backtrackingSearch(): Map<string, boolean> | null {
    const assignment = new Map<string, boolean>();
    const unassignedVars = Array.from(this.variables.keys()).filter(id => 
      this.variables.get(id)!.domain
    );

    return this.backtrack(assignment, unassignedVars);
  }

  private backtrack(assignment: Map<string, boolean>, unassigned: string[]): Map<string, boolean> | null {
    if (unassigned.length === 0) {
      return this.isAssignmentComplete(assignment) ? assignment : null;
    }

    // Choose variable using MRV (Minimum Remaining Values) heuristic
    const variable = this.chooseVariable(unassigned);
    const remaining = unassigned.filter(v => v !== variable);

    // Try assigning true
    assignment.set(variable, true);
    if (this.isConsistent(assignment, variable)) {
      // Apply forward checking
      const inference = this.forwardCheck(assignment, variable, remaining);
      if (inference !== null) {
        const result = this.backtrack(assignment, inference);
        if (result !== null) return result;
      }
    }

    // Try assigning false
    assignment.set(variable, false);
    if (this.isConsistent(assignment, variable)) {
      const result = this.backtrack(assignment, remaining);
      if (result !== null) return result;
    }

    // Backtrack
    assignment.delete(variable);
    return null;
  }

  private chooseVariable(unassigned: string[]): string {
    // MRV heuristic: choose variable with fewest remaining values
    let minConflicts = Infinity;
    let bestVariable = unassigned[0];

    for (const varId of unassigned) {
      const conflicts = this.countConflicts(varId);
      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        bestVariable = varId;
      }
    }

    return bestVariable;
  }

  private countConflicts(variableId: string): number {
    let conflicts = 0;

    for (const constraint of this.constraintList) {
      if (constraint.variables.includes(variableId)) {
        conflicts++;
      }
    }

    return conflicts;
  }

  private isConsistent(assignment: Map<string, boolean>, variable: string): boolean {
    const relevantConstraints = this.constraintList.filter(c => 
      c.variables.includes(variable)
    );

    for (const constraint of relevantConstraints) {
      if (!this.checkConstraint(constraint, assignment)) {
        return false;
      }
    }

    return true;
  }

  private checkConstraint(constraint: Constraint, assignment: Map<string, boolean>): boolean {
    if (constraint.type === 'resource_conflict') {
      // At most one variable in the constraint can be true
      let trueCount = 0;
      for (const varId of constraint.variables) {
        if (assignment.get(varId) === true) {
          trueCount++;
        }
      }
      return trueCount <= 1;
    }

    return true;
  }

  private forwardCheck(assignment: Map<string, boolean>, _variable: string, remaining: string[]): string[] | null {
    // Simple forward checking - remove variables that would cause conflicts
    const validRemaining = remaining.filter(varId => {
      // Check if this variable would conflict with current assignment
      const tempAssignment = new Map(assignment);
      tempAssignment.set(varId, true);
      return this.isConsistent(tempAssignment, varId);
    });

    return validRemaining;
  }

  private isAssignmentComplete(assignment: Map<string, boolean>): boolean {
    // Check if all required subjects are assigned
    const requiredSubjects = new Set<string>();
    
    for (const course of this.courses) {
      for (const section of course.sections || []) {
        for (const subject of this.subjects) {
          if (subject.courseId === course.id) {
            requiredSubjects.add(`${subject.id}_${section}`);
          }
        }
      }
    }

    const assignedSubjects = new Set<string>();
    assignment.forEach((value, varId) => {
      if (value === true) {
        const variable = this.variables.get(varId);
        if (variable) {
          assignedSubjects.add(`${variable.subjectId}_${variable.section}`);
        }
      }
    });

    // At least 70% of required subjects should be assigned
    const coverage = assignedSubjects.size / Math.max(requiredSubjects.size, 1);
    return coverage >= 0.7;
  }

  private assignmentToSchedule(assignment: Map<string, boolean>): ClassSchedule[] {
    const schedule: ClassSchedule[] = [];
    
    assignment.forEach((value, varId) => {
      if (value === true) {
        const variable = this.variables.get(varId);
        if (variable) {
          const timeSlot = this.timeSlots.find(ts => ts.id === variable.timeSlotId);
          if (timeSlot) {
            schedule.push({
              id: `class_${Date.now()}_${Math.random()}`,
              courseId: variable.courseId,
              subjectId: variable.subjectId,
              section: variable.section,
              teacherId: variable.teacherId,
              roomId: variable.roomId,
              timeSlotId: variable.timeSlotId,
              day: timeSlot.day,
              startTime: timeSlot.startTime,
              endTime: timeSlot.endTime
            });
          }
        }
      }
    });

    return schedule;
  }

  private async solveWithRelaxedConstraints(): Promise<OptimizationResult> {
    // Fallback: use the original constraint-based approach
    const schedule = this.generateConstraintBasedSchedule();
    const conflicts = this.detectConflicts(schedule);
    const metrics = this.calculateMetrics(schedule, conflicts);

    return {
      schedule,
      fitness: this.calculateFitness(schedule),
      conflicts,
      metrics,
      generationData: []
    };
  }

  private generateConstraintBasedSchedule(): ClassSchedule[] {
    const schedule: ClassSchedule[] = [];
    const roomTimeSlotUsage = new Map<string, Set<string>>();
    const teacherTimeSlotUsage = new Map<string, Set<string>>();

    // Sort courses by constraints (most constrained first)
    const sortedCourses = [...this.courses].sort((a, b) => {
      const aConstraints = this.getConstraintScore(a);
      const bConstraints = this.getConstraintScore(b);
      return bConstraints - aConstraints;
    });

    for (const course of sortedCourses) {
      const teacher = this.teachers.find(t => t.id === course.teacherId);
      if (!teacher) continue;

      for (let session = 0; session < course.sessionsPerWeek; session++) {
        const assignment = this.findBestAssignment(course, teacher, roomTimeSlotUsage, teacherTimeSlotUsage);
        
        if (assignment) {
          schedule.push(assignment);
          
          // Update usage maps
          const roomTimeKey = `${assignment.roomId}_${assignment.day}_${assignment.startTime}`;
          const teacherTimeKey = `${assignment.teacherId}_${assignment.day}_${assignment.startTime}`;
          
          if (!roomTimeSlotUsage.has(assignment.roomId)) {
            roomTimeSlotUsage.set(assignment.roomId, new Set());
          }
          if (!teacherTimeSlotUsage.has(assignment.teacherId)) {
            teacherTimeSlotUsage.set(assignment.teacherId, new Set());
          }
          
          roomTimeSlotUsage.get(assignment.roomId)!.add(roomTimeKey);
          teacherTimeSlotUsage.get(assignment.teacherId)!.add(teacherTimeKey);
        }
      }
    }

    return schedule;
  }

  private getConstraintScore(course: Course): number {
    let score = 0;
    
    // More specialized room requirements = higher constraint
    score += course.requiredEquipment.length * 10;
    
    // Larger classes = more room constraints
    score += Math.log(course.studentsCount) * 5;
    
    // More sessions per week = scheduling constraint
    score += course.sessionsPerWeek * 3;

    return score;
  }

  private findBestAssignment(
    course: Course, 
    teacher: Teacher,
    roomUsage: Map<string, Set<string>>,
    teacherUsage: Map<string, Set<string>>
  ): ClassSchedule | null {
    const availableAssignments: ClassSchedule[] = [];

    for (const room of this.rooms) {
      if (room.type !== course.roomType || room.capacity < course.studentsCount) {
        continue;
      }

      if (!course.requiredEquipment.every(eq => room.equipment.includes(eq))) {
        continue;
      }

      for (const timeSlot of this.timeSlots) {
        // Check teacher availability
        const teacherAvailable = teacher.availability.some(avail => 
          avail.day === timeSlot.day && avail.timeSlots.includes(timeSlot.id)
        );

        if (!teacherAvailable) continue;

        // Check room availability
        const roomTimeKey = `${room.id}_${timeSlot.day}_${timeSlot.startTime}`;
        const teacherTimeKey = `${teacher.id}_${timeSlot.day}_${timeSlot.startTime}`;

        const roomAvailable = !roomUsage.get(room.id)?.has(roomTimeKey);
        const teacherTimeAvailable = !teacherUsage.get(teacher.id)?.has(teacherTimeKey);

        if (roomAvailable && teacherTimeAvailable) {
          availableAssignments.push({
            id: `${course.id}_${Date.now()}_${Math.random()}`,
            courseId: course.id,
            teacherId: teacher.id,
            roomId: room.id,
            timeSlotId: timeSlot.id,
            day: timeSlot.day,
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime
          });
        }
      }
    }

    // Return the best assignment based on preferences
    if (availableAssignments.length === 0) return null;

    // Prefer assignments within preferred time window
    const preferredAssignments = availableAssignments.filter(assignment => {
      const startTime = new Date(`1970-01-01T${assignment.startTime}`);
      const preferredStart = new Date(`1970-01-01T${this.constraints.preferredStartTime}`);
      const preferredEnd = new Date(`1970-01-01T${this.constraints.preferredEndTime}`);
      
      return startTime >= preferredStart && startTime <= preferredEnd;
    });

    return preferredAssignments.length > 0 
      ? preferredAssignments[0] 
      : availableAssignments[0];
  }

  private detectConflicts(schedule: ClassSchedule[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Room conflicts
    const roomTimeMap = new Map<string, ClassSchedule[]>();
    
    schedule.forEach(cls => {
      const key = `${cls.roomId}_${cls.day}_${cls.startTime}`;
      if (!roomTimeMap.has(key)) {
        roomTimeMap.set(key, []);
      }
      roomTimeMap.get(key)!.push(cls);
    });

    roomTimeMap.forEach((classes, key) => {
      if (classes.length > 1) {
        conflicts.push({
          type: 'room_conflict',
          description: `Room conflict at ${key}`,
          severity: 'high',
          classes: classes.map(c => c.id)
        });
      }
    });

    // Teacher conflicts
    const teacherTimeMap = new Map<string, ClassSchedule[]>();
    
    schedule.forEach(cls => {
      const key = `${cls.teacherId}_${cls.day}_${cls.startTime}`;
      if (!teacherTimeMap.has(key)) {
        teacherTimeMap.set(key, []);
      }
      teacherTimeMap.get(key)!.push(cls);
    });

    teacherTimeMap.forEach((classes, key) => {
      if (classes.length > 1) {
        conflicts.push({
          type: 'teacher_conflict',
          description: `Teacher conflict at ${key}`,
          severity: 'high',
          classes: classes.map(c => c.id)
        });
      }
    });

    return conflicts;
  }

  private calculateMetrics(schedule: ClassSchedule[], conflicts: Conflict[]): OptimizationMetrics {
    const totalConflicts = conflicts.length;
    
    // Room utilization
    const roomUsage = new Map<string, number>();
    schedule.forEach(cls => {
      roomUsage.set(cls.roomId, (roomUsage.get(cls.roomId) || 0) + 1);
    });
    
    const totalSlots = this.timeSlots.length * 5; // 5 days
    const roomUtilization = Array.from(roomUsage.values())
      .reduce((sum, usage) => sum + usage, 0) / (this.rooms.length * totalSlots);

    // Teacher workload balance
    const teacherWorkload = new Map<string, number>();
    schedule.forEach(cls => {
      teacherWorkload.set(cls.teacherId, (teacherWorkload.get(cls.teacherId) || 0) + 1);
    });

    const workloads = Array.from(teacherWorkload.values());
    const avgWorkload = workloads.reduce((sum, load) => sum + load, 0) / workloads.length;
    const workloadVariance = workloads.reduce((sum, load) => sum + Math.pow(load - avgWorkload, 2), 0) / workloads.length;
    const teacherWorkloadBalance = Math.max(0, 1 - (workloadVariance / (avgWorkload * avgWorkload || 1)));

    return {
      totalConflicts,
      roomUtilization,
      teacherWorkloadBalance,
      studentSatisfaction: Math.max(0, 1 - (totalConflicts / schedule.length)),
      constraintSatisfaction: Math.max(0, 1 - (totalConflicts / 10))
    };
  }

  private calculateFitness(schedule: ClassSchedule[]): number {
    const conflicts = this.detectConflicts(schedule);
    let fitness = 1000 - conflicts.length * 50;
    return Math.max(fitness, 0);
  }
}