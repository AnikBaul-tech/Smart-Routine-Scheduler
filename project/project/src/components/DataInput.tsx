import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Users, Clock, MapPin, User, BookOpen } from 'lucide-react';
import { Course, Teacher, Room, TimeSlot, TimetableConstraints, Subject } from '../types/timetable';
import { generateDemoData } from '../data/demoData';

interface DataInputProps {
  onDataSubmit: (data: {
    courses: Course[];
    teachers: Teacher[];
    rooms: Room[];
    timeSlots: TimeSlot[];
    constraints: TimetableConstraints;
    subjects: Subject[];
  }) => void;
  initialData?: {
    courses: Course[];
    teachers: Teacher[];
    rooms: Room[];
    subjects: Subject[];
  };
}

export const DataInput: React.FC<DataInputProps> = ({ onDataSubmit, initialData }) => {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState<Course[]>(initialData?.courses || []);
  const [subjects, setSubjects] = useState<Subject[]>(initialData?.subjects || []);
  const [teachers, setTeachers] = useState<Teacher[]>(initialData?.teachers || []);
  const [rooms, setRooms] = useState<Room[]>(initialData?.rooms || []);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  
  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  useEffect(() => {
    // Ensure RHF knows about this field for programmatic updates
    register('teacherSubjectIds');
  }, [register]);

  // Keep teacher subjects constrained to selected department
  const selectedDepartmentCourseId = watch('teacherDepartmentCourseId');
  useEffect(() => {
    const current: string[] = watch('teacherSubjectIds') || [];
    const filtered = current.filter(id => {
      const s = subjects.find(ss => ss.id === id);
      return s && s.courseId === selectedDepartmentCourseId;
    });
    if (filtered.length !== current.length) {
      setValue('teacherSubjectIds', filtered, { shouldDirty: true });
    }
  }, [selectedDepartmentCourseId, subjects]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const roomTypes = ['theory', 'lab'] as const;

  const addCourse = (data: any) => {
    const selectedSemester = parseInt(data.semester, 10);
    const sectionsCountRaw = parseInt(data.sectionsCount, 10);
    const sectionsCount = isNaN(sectionsCountRaw) ? 0 : Math.max(0, Math.min(sectionsCountRaw, 26));
    const sections = Array.from({ length: sectionsCount }, (_, i) => String.fromCharCode(65 + i));
    const newCourse: Course = {
      id: `course_${Date.now()}`,
      name: data.courseName,
      // Provide minimal defaults for removed fields to satisfy existing logic
      code: '',
      credits: 0,
      duration: 1,
      teacherId: '',
      studentsCount: 0,
      roomType: 'theory',
      requiredEquipment: [],
      sessionsPerWeek: 1,
      semester: isNaN(selectedSemester) ? undefined : selectedSemester,
      sections
    };
    setCourses([...courses, newCourse]);
    reset();
  };

  const addSubject = (data: any) => {
    const selectedCourseId: string = data.subjectCourseId;
    const selectedSemester: number = parseInt(data.subjectSemester, 10);
    const name: string = data.subjectName?.trim();
    const code: string = data.subjectCode?.trim();
    const type: 'theory' | 'lab' | undefined = data.subjectType;

    if (!selectedCourseId || isNaN(selectedSemester) || !name || !code || !type) return;

    const newSubject: Subject = {
      id: `subject_${Date.now()}`,
      courseId: selectedCourseId,
      semester: selectedSemester,
      name,
      code,
      type
    };
    setSubjects(prev => [...prev, newSubject]);
    // Do not reset the entire form to avoid clearing course inputs; clear only subject fields
    reset({
      subjectCourseId: selectedCourseId,
      subjectSemester: String(selectedSemester),
      subjectName: '',
      subjectCode: '',
      subjectType: type
    });
  };

  const deleteSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const addTeacher = (data: any) => {
    const newTeacher: Teacher = {
      id: `teacher_${Date.now()}`,
      name: data.teacherName,
      email: data.teacherEmail,
      subjects: data.subjects ? data.subjects.split(',').map((s: string) => s.trim()) : [],
      departmentCourseId: data.teacherDepartmentCourseId || undefined,
      taughtSubjectIds: Array.isArray(data.teacherSubjectIds) ? data.teacherSubjectIds : (data.teacherSubjectIds ? [data.teacherSubjectIds] : []),
      availability: days.map(day => ({
        day,
        timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
      })),
      maxHoursPerDay: parseInt(data.maxHoursPerDay) || 8,
      maxHoursPerWeek: parseInt(data.maxHoursPerWeek) || 40
    };
    setTeachers([...teachers, newTeacher]);
    reset();
  };

  const addRoom = (data: any) => {
    const newRoom: Room = {
      id: `room_${Date.now()}`,
      name: data.roomName,
      capacity: parseInt(data.capacity) || 0,
      type: data.roomType,
      equipment: data.equipment ? data.equipment.split(',').map((s: string) => s.trim()) : []
    };
    setRooms([...rooms, newRoom]);
    reset();
  };

  const to24h = (input: string) => input || '';

  const generateDefaultTimeSlots = (start?: string, end?: string): TimeSlot[] => {
    const preferredStart = start ? to24h(start) : '09:00';
    const preferredEnd = end ? to24h(end) : '17:00';
    const [sh, sm] = preferredStart.split(':').map(n => parseInt(n, 10));
    const [eh, em] = preferredEnd.split(':').map(n => parseInt(n, 10));
    const theoryStep = parseInt(watch('theoryIntervalMinutes') || '60', 10) || 60;
    const labStep = parseInt(watch('labIntervalMinutes') || '120', 10) || 120;

    const slots: TimeSlot[] = [];
    days.forEach(day => {
      let curH = sh;
      let curM = sm;
      while (curH < eh || (curH === eh && curM < em)) {
        const startStr = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
        // choose interval based on a simplistic alternation; real logic would map subjects to types
        const stepMinutes = (slots.length % 3 === 2) ? labStep : theoryStep;
        let nextH = curH;
        let nextM = curM + stepMinutes;
        while (nextM >= 60) { nextH += 1; nextM -= 60; }
        const endStr = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
        if (nextH > eh || (nextH === eh && nextM > em)) break;
        slots.push({ id: `${day}_${startStr}`, day, startTime: startStr, endTime: endStr });
        curH = nextH; curM = nextM;
      }
    });
    setTimeSlots(slots);
    return slots;
  };



  const handleGenerateTimetable = () => {
    const startInput = watch('collegeStart');
    const endInput = watch('collegeEnd');
    let slotsToUse = timeSlots;
    if (slotsToUse.length === 0) {
      slotsToUse = generateDefaultTimeSlots(startInput, endInput);
    }

    const constraints: TimetableConstraints = {
      maxClassesPerDay: 6,
      minBreakBetweenClasses: 15,
      preferredStartTime: startInput ? to24h(startInput) : '09:00',
      preferredEndTime: endInput ? to24h(endInput) : '17:00',
      avoidBackToBackClasses: true,
      balanceWorkload: true,
      semesterParity: watch('semesterParity') || undefined,
      theoryIntervalMinutes: parseInt(watch('theoryIntervalMinutes') || '60', 10) || 60,
      labIntervalMinutes: parseInt(watch('labIntervalMinutes') || '120', 10) || 120
    };

    onDataSubmit({
      courses,
      teachers,
      rooms,
      timeSlots: slotsToUse,
      constraints,
      subjects
    });
  };

  const TabButton = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Input Timetable Data</h2>
        <button
          type="button"
          onClick={() => {
            const { courses: demoCourses, subjects: demoSubjects, teachers: demoTeachers, rooms: demoRooms, settings } = generateDemoData();
            setCourses(demoCourses);
            setSubjects(demoSubjects);
            setTeachers(demoTeachers);
            setRooms(demoRooms);
            // Prefill generation settings
            setValue('collegeStart', settings.collegeStart, { shouldDirty: true });
            setValue('collegeEnd', settings.collegeEnd, { shouldDirty: true });
            setValue('semesterParity', settings.semesterParity, { shouldDirty: true });
            setValue('theoryIntervalMinutes', String(settings.theoryIntervalMinutes), { shouldDirty: true });
            setValue('labIntervalMinutes', String(settings.labIntervalMinutes), { shouldDirty: true });
          }}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Add Demo Data
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8">
        <TabButton id="courses" label="Courses" icon={Users} />
        <TabButton id="subjects" label="Subjects" icon={BookOpen} />
        <TabButton id="teachers" label="Teachers" icon={User} />
        <TabButton id="rooms" label="Rooms" icon={MapPin} />
        <TabButton id="summary" label="TimeTable" icon={Clock} />
      </div>

      {/* Course Input */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmit(addCourse)} className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Course</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Name</label>
                <input
                  {...register('courseName', { required: true })}
                  placeholder="Enter course name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Semesters</label>
                <select
                  {...register('semester')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue=""
                >
                  <option value="">Select No. of Semesters</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Sections</label>
                <input
                  {...register('sectionsCount')}
                  type="number"
                  min={0}
                  max={26}
                  placeholder="Enter number of sections (A, B, C...)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              <span>Add Course</span>
            </button>
            {/* Course List */}
            <div className="space-y-3 mt-6">
              <h3 className="text-lg font-semibold text-gray-800">Courses ({courses.length})</h3>
              {courses.map((course, index) => (
                <div key={course.id} className="bg-white border border-gray-200 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-800">{course.name}</h4>
                    {course.semester && (
                      <p className="text-sm text-gray-600">No. of semesters: {course.semester}</p>
                    )}
                    {course.sections && course.sections.length > 0 && (
                      <p className="text-sm text-gray-600">Sections: {course.sections.join(', ')}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setCourses(courses.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </form>
        </div>
      )}

      {/* Subject Input */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmit(addSubject)} className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Subject</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                <select
                  {...register('subjectCourseId', { required: true })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue=""
                >
                  <option value="">Select Course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const selectedCourseId = watch('subjectCourseId');
                const course = courses.find(c => c.id === selectedCourseId);
                const maxSemesters = course?.semester ?? 8;
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                    <select
                      {...register('subjectSemester', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      defaultValue=""
                    >
                      <option value="">Select Semester</option>
                      {Array.from({ length: maxSemesters }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{`Sem ${num}`}</option>
                      ))}
                    </select>
                  </div>
                );
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Type</label>
                <select
                  {...register('subjectType', { required: true })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue="theory"
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Lab</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name</label>
                <input
                  {...register('subjectName', { required: true })}
                  placeholder="Enter subject name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Code</label>
                <input
                  {...register('subjectCode', { required: true })}
                  placeholder="Enter subject code"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus size={18} />
              <span>Add Subject</span>
            </button>
          </form>

          {/* Subject List for selected course & semester */}
          <div className="space-y-3">
            {(() => {
              const selectedCourseId = watch('subjectCourseId');
              const semStr = watch('subjectSemester');
              const sem = parseInt(semStr || '', 10);
              const filtered = subjects.filter(s => s.courseId === selectedCourseId && s.semester === sem);
              const selectedCourse = courses.find(c => c.id === selectedCourseId);
              return (
                <>
                  <h4 className="text-lg font-semibold text-gray-800">
                    {selectedCourse ? `${selectedCourse.name}${!isNaN(sem) ? ` • Sem ${sem}` : ''}` : 'Select course & semester'}
                  </h4>
                  {filtered.map(subj => (
                    <div key={subj.id} className="bg-white border border-gray-200 p-4 rounded-lg flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-800">{subj.name}</div>
                        <div className="text-sm text-gray-600">{subj.code} • {subj.type === 'lab' ? 'Lab' : 'Theory'}</div>
                      </div>
                      <button onClick={() => deleteSubject(subj.id)} className="text-red-500 hover:text-red-700 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Teacher Input */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmit(addTeacher)} className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Teacher</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher Name</label>
                <input
                  {...register('teacherName', { required: true })}
                  placeholder="Enter teacher name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  {...register('teacherEmail', { required: true })}
                  type="email"
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  {...register('teacherDepartmentCourseId')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue=""
                >
                  <option value="">Select Department</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subjects</label>
                <button
                  type="button"
                  onClick={() => setIsSubjectDropdownOpen(v => !v)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  Select subjects
                </button>
                {isSubjectDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow">
                    <div className="max-h-48 overflow-auto p-2 space-y-1">
                      {(subjects.filter(s => !selectedDepartmentCourseId || s.courseId === selectedDepartmentCourseId)).map(s => {
                        const current: string[] = watch('teacherSubjectIds') || [];
                        const checked = current.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const prev: string[] = watch('teacherSubjectIds') || [];
                                const next = e.target.checked
                                  ? Array.from(new Set([...prev, s.id]))
                                  : prev.filter(id => id !== s.id);
                                setValue('teacherSubjectIds', next, { shouldDirty: true });
                              }}
                            />
                            <span className="text-sm text-gray-700">{`${s.name} (${s.code})`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Selected tags */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(watch('teacherSubjectIds') || []).filter((id: string) => {
                    const s = subjects.find(ss => ss.id === id);
                    return s && (!selectedDepartmentCourseId || s.courseId === selectedDepartmentCourseId);
                  }).map((id: string) => {
                    const s = subjects.find(ss => ss.id === id);
                    if (!s) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                        {`${s.name} (${s.code})`}
                        <button
                          type="button"
                          className="ml-1 text-blue-600 hover:text-blue-800"
                          onClick={() => {
                            const prev: string[] = watch('teacherSubjectIds') || [];
                            const next = prev.filter(x => x !== id);
                            setValue('teacherSubjectIds', next, { shouldDirty: true });
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus size={18} />
              <span>Add Teacher</span>
            </button>
          </form>

          {/* Teacher List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Teachers ({teachers.length})</h3>
            {teachers.map((teacher, index) => (
              <div key={teacher.id} className="bg-white border border-gray-200 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-gray-800">{teacher.name}</h4>
                    <p className="text-sm text-gray-600">{teacher.email}</p>
                    {teacher.departmentCourseId && (
                      <p className="text-sm text-gray-600">
                        Department: {courses.find(c => c.id === teacher.departmentCourseId)?.name || 'Unknown'}
                      </p>
                    )}
                    {teacher.taughtSubjectIds && teacher.taughtSubjectIds.length > 0 && (
                      <p className="text-sm text-gray-600">
                        Select subjects: {teacher.taughtSubjectIds.map(id => {
                          const s = subjects.find(ss => ss.id === id);
                          return s ? `${s.name} (${s.code})` : 'Unknown';
                        }).join(', ')}
                      </p>
                    )}
                </div>
                <button
                  onClick={() => setTeachers(teachers.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room Input */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmit(addRoom)} className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Room</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Room Name</label>
                <input
                  {...register('roomName', { required: true })}
                  placeholder="Enter room name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
                <select
                  {...register('roomType', { required: true })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Room Type</option>
                  {roomTypes.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 flex items-center space-x-2 bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus size={18} />
              <span>Add Room</span>
            </button>
          </form>

          {/* Room List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Rooms ({rooms.length})</h3>
            {rooms.map((room, index) => (
              <div key={room.id} className="bg-white border border-gray-200 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-gray-800">{room.name}</h4>
                  <p className="text-sm text-gray-600">
                    {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                  </p>
                </div>
                <button
                  onClick={() => setRooms(rooms.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TimeTable */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg text-center">
              <div className="text-3xl font-bold text-blue-600">{courses.length}</div>
              <div className="text-gray-600 font-medium">Courses</div>
            </div>
            <div className="bg-emerald-50 p-6 rounded-lg text-center">
              <div className="text-3xl font-bold text-emerald-600">{teachers.length}</div>
              <div className="text-gray-600 font-medium">Teachers</div>
            </div>
            <div className="bg-orange-50 p-6 rounded-lg text-center">
              <div className="text-3xl font-bold text-orange-600">{rooms.length}</div>
              <div className="text-gray-600 font-medium">Rooms</div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Generation Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester Parity</label>
                <select
                  {...register('semesterParity')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue=""
                >
                  <option value="">Select Parity (All)</option>
                  <option value="odd">Odd semesters</option>
                  <option value="even">Even semesters</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">College Start Time</label>
                <input
                  {...register('collegeStart')}
                  type="time"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">College End Time</label>
                <input
                  {...register('collegeEnd')}
                  type="time"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Theory Class Interval (minutes)</label>
                <input
                  {...register('theoryIntervalMinutes')}
                  type="number"
                  min={30}
                  step={5}
                  placeholder="Enter theory interval"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lab Class Interval (minutes)</label>
                <input
                  {...register('labIntervalMinutes')}
                  type="number"
                  min={30}
                  step={5}
                  placeholder="Enter lab interval"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            <button
              onClick={handleGenerateTimetable}
              disabled={courses.length === 0 || teachers.length === 0 || rooms.length === 0}
              className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-emerald-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Generate Timetable
            </button>
            {(courses.length === 0 || teachers.length === 0 || rooms.length === 0) && (
              <p className="text-red-500 text-sm">Please add at least one course, teacher, and room before generating.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
