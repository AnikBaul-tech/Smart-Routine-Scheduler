import { useEffect, useState } from 'react';
import { OptimizationResult, ClassSchedule, Course, Teacher, Room, Subject } from '../types/timetable';
import { Clock, MapPin, User, AlertTriangle } from 'lucide-react';

interface TimetableDisplayProps {
  result: OptimizationResult;
  courses: Course[];
  teachers: Teacher[];
  rooms: Room[];
  subjects: Subject[];
}

export const TimetableDisplay: React.FC<TimetableDisplayProps> = ({
  result,
  courses,
  teachers,
  rooms,
  subjects
}) => {
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');

  // Auto-select defaults once data is available
  useEffect(() => {
    const availableCourses = getAvailableCourses();
    if (!selectedCourse && availableCourses.length > 0) {
      setSelectedCourse(availableCourses[0].id);
    }
  }, [result, courses]);

  useEffect(() => {
    const semesters = getAvailableSemesters();
    if (!selectedSemester && semesters.length > 0) {
      setSelectedSemester(semesters[0]);
    } else if (selectedSemester && semesters.length > 0 && !semesters.includes(selectedSemester as number)) {
      setSelectedSemester(semesters[0]);
    }
  }, [selectedCourse, result]);
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const formatTime12h = (time24: string): string => {
    // Expecting HH:MM
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr || '0', 10);
    const m = parseInt(mStr || '0', 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const mm = String(m).padStart(2, '0');
    return `${h}:${mm} ${suffix}`;
  };

  // Get available semesters and courses from the generated schedule
  const getAvailableSemesters = (): number[] => {
    const semesters = new Set<number>();
    result.schedule
      .filter((cls: ClassSchedule) => !selectedCourse || cls.courseId === selectedCourse)
      .forEach((cls: ClassSchedule) => {
        if (typeof cls.semester === 'number') {
          semesters.add(cls.semester);
        }
      });
    return Array.from(semesters).sort((a, b) => a - b);
  };

  const getAvailableCourses = (): Course[] => {
    const courseSet = new Set<string>();
    result.schedule.forEach((cls: ClassSchedule) => {
      if (cls.courseId) {
        courseSet.add(cls.courseId);
      }
    });
    return Array.from(courseSet)
      .map(id => courses.find((c: Course) => c.id === id))
      .filter((course: Course | undefined): course is Course => course !== undefined);
  };

  const getFilteredSchedule = (): ClassSchedule[] => {
    if (!selectedCourse || !selectedSemester) return [];
    return result.schedule.filter((cls: ClassSchedule) => {
      const courseMatch = cls.courseId === selectedCourse;
      const semesterMatch = cls.semester === selectedSemester;
      return courseMatch && semesterMatch;
    });
  };

  const getTimeSlotsForFiltered = (): string[] => {
    const timeSet = new Set<string>();
    getFilteredSchedule().forEach((cls: ClassSchedule) => {
      if (cls.startTime) {
        timeSet.add(cls.startTime);
      }
    });
    const sorted = Array.from(timeSet).sort((a, b) => a.localeCompare(b));
    // Fallback to a reasonable default if nothing scheduled yet
    return sorted.length > 0 ? sorted : ['10:00', '10:40', '11:20', '12:00', '12:40', '14:00', '14:40', '15:20', '16:00', '16:40'];
  };

  const getSectionsForFiltered = (): string[] => {
    // If a course is selected and it has declared sections, display all of them
    if (selectedCourse) {
      const course = courses.find((c: Course) => c.id === selectedCourse);
      if (course && Array.isArray(course.sections) && course.sections.length > 0) {
        return [...course.sections].sort();
      }
    }
    // Otherwise, infer from scheduled classes
    const sections = new Set<string>();
    getFilteredSchedule().forEach((cls: ClassSchedule) => {
      if (cls.section) {
        sections.add(cls.section);
      }
    });
    return Array.from(sections).sort();
  };

  const getTeacherDetails = (teacherId: string) => {
    return teachers.find((t: Teacher) => t.id === teacherId);
  };

  const getRoomDetails = (roomId: string) => {
    return rooms.find((r: Room) => r.id === roomId);
  };

  const getSubjectDetails = (subjectId?: string) => {
    return subjects.find((s: Subject) => s.id === subjectId);
  };

  const getConflictSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-orange-600 bg-orange-100';
      case 'low': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const SectionTimetable = ({ section, sectionClasses, timeSlots }: { section: string; sectionClasses: ClassSchedule[]; timeSlots: string[] }) => (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 mb-6">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-800">Section {section}</h4>
        <p className="text-sm text-gray-600">{sectionClasses.length} classes scheduled</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-200 p-2 bg-gray-50 text-left font-medium text-gray-700">
                <Clock size={16} className="inline mr-1" />
                Time
              </th>
              {days.map(day => (
                <th key={day} className="border border-gray-200 p-2 bg-gray-50 text-center font-medium text-gray-700 min-w-40">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(time => (
              <tr key={time}>
                <td className="border border-gray-200 p-2 bg-gray-50 font-medium text-gray-700">
                  {formatTime12h(time)}
                </td>
                {days.map(day => {
                  const classInfo = sectionClasses.find((cls: ClassSchedule) => cls.day === day && cls.startTime === time);
                  if (!classInfo) {
                    return (
                      <td key={`${day}-${time}`} className="border border-gray-200 p-2 h-16">
                        <div className="text-gray-300 text-center text-xs">Free</div>
                      </td>
                    );
                  }

                  const subject = getSubjectDetails(classInfo.subjectId);
                  const teacher = getTeacherDetails(classInfo.teacherId);
                  const room = getRoomDetails(classInfo.roomId);

                  return (
                    <td key={`${day}-${time}`} className="border border-gray-200 p-1">
                      <div className={`p-2 rounded text-xs ${
                        subject?.type === 'lab' 
                          ? 'bg-orange-50 border-l-4 border-orange-400' 
                          : 'bg-blue-50 border-l-4 border-blue-400'
                      }`}>
                        <div className="font-semibold text-gray-800 mb-1">
                          {subject?.name || 'Unknown Subject'}
                        </div>
                        <div className="text-gray-600 space-y-0.5">
                          <div className="font-medium text-blue-600">
                            <span className="text-gray-500 text-xs">Code:</span> {subject?.code || 'N/A'}
                          </div>
                          <div className="flex items-center">
                            <User size={10} className="mr-1" />
                            <span className="text-gray-500 text-xs mr-1">Teacher:</span>
                            <span className="truncate">{teacher?.name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin size={10} className="mr-1" />
                            <span className="text-gray-500 text-xs mr-1">Room:</span>
                            <span>{room?.name || 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Filter Timetables</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Course Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {getAvailableCourses().map((course: Course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>

          {/* Semester Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {getAvailableSemesters().map((semester: number) => (
                <option key={semester} value={semester}>Semester {semester}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Results Info */}
        {selectedCourse && selectedSemester && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Showing results for{' '}
              {selectedCourse && courses.find((c: Course) => c.id === selectedCourse)?.name}
              {selectedCourse && selectedSemester && ' - '}
              {selectedSemester && `Semester ${selectedSemester}`}
            </p>
          </div>
        )}
      </div>

      {/* Conflicts Summary */}
      {result.conflicts.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="text-red-500" size={24} />
            <h3 className="text-xl font-bold text-gray-800">Scheduling Conflicts ({result.conflicts.length})</h3>
          </div>
          <div className="space-y-3">
            {result.conflicts.slice(0, 5).map((conflict: any, index: number) => (
              <div key={index} className={`p-4 rounded-lg border ${getConflictSeverityColor(conflict.severity)}`}>
                <div className="font-medium">{conflict.type.replace('_', ' ').toUpperCase()}</div>
                <div className="text-sm mt-1">{conflict.description}</div>
              </div>
            ))}
            {result.conflicts.length > 5 && (
              <div className="text-center text-gray-500 text-sm">
                ... and {result.conflicts.length - 5} more conflicts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section-wise Timetables */}
      <div className="space-y-6">
        {getSectionsForFiltered().length > 0 ? (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Weekly Schedules by Section
              </h3>
              <p className="text-gray-600 mb-6">
                {getSectionsForFiltered().length} section(s) found for the selected filters
              </p>
            </div>

            {(() => {
              const timeSlots = getTimeSlotsForFiltered();
              return getSectionsForFiltered().map((section: string) => {
                const sectionClasses = getFilteredSchedule().filter((cls: ClassSchedule) => cls.section === section);
                return (
                  <SectionTimetable
                    key={section}
                    section={section}
                    sectionClasses={sectionClasses}
                    timeSlots={timeSlots}
                  />
                );
              });
            })()}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Schedules Found</h3>
            <p className="text-gray-600">
              No timetables match the selected filters. Try adjusting your course and semester selection.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};