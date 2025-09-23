import { useState } from 'react';
import { Calendar, Settings, Download, Target, Activity } from 'lucide-react';
import { DataInput } from './components/DataInput';
import { TimetableDisplay } from './components/TimetableDisplay';
import { OptimizationProgress } from './components/OptimizationProgress';
import { HybridOptimizer } from './utils/hybridOptimizer';
import { 
  OptimizationResult, 
  Course, 
  Teacher, 
  Room, 
  TimeSlot, 
  TimetableConstraints,
  GenerationData,
  Subject
} from './types/timetable';

function App() {
  const [currentView, setCurrentView] = useState<'input' | 'results'>('input');

  const [optimizationData, setOptimizationData] = useState<{
    courses: Course[];
    teachers: Teacher[];
    rooms: Room[];
    timeSlots: TimeSlot[];
    constraints: TimetableConstraints;
    subjects: Subject[];
  } | null>(null);
  
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [bestFitness, setBestFitness] = useState(0);
  const [generationData, setGenerationData] = useState<GenerationData[]>([]);

  const handleDataSubmit = (data: {
    courses: Course[];
    teachers: Teacher[];
    rooms: Room[];
    timeSlots: TimeSlot[];
    constraints: TimetableConstraints;
    subjects: Subject[];
  }) => {
    setOptimizationData(data);
    // Don't switch views immediately - let optimization complete first
    startOptimization(data);
  };

  const startOptimization = async (data: {
    courses: Course[];
    teachers: Teacher[];
    rooms: Room[];
    timeSlots: TimeSlot[];
    constraints: TimetableConstraints;
    subjects: Subject[];
  }) => {
    setIsOptimizing(true);
    setProgress(0);
    setGeneration(0);
    setBestFitness(0);
    setGenerationData([]);
    
    // Switch to results view after starting optimization
    setCurrentView('results');

    try {
      const optimizer = new HybridOptimizer(
        data.courses,
        data.teachers,
        data.rooms,
        data.timeSlots,
        data.constraints,
        data.subjects
      );

      const params = {
        populationSize: 50,
        generations: 100,
        mutationRate: 0.1,
        crossoverRate: 0.8,
        eliteSize: 10
      };

      console.log('Optimizer created, starting optimization...');
      const result = await optimizer.optimize(params, (prog, gen, fitness) => {
        setProgress(prog);
        setGeneration(gen);
        setBestFitness(fitness);
        console.log(`Progress: ${prog}%, Generation: ${gen}, Fitness: ${fitness}`);
      });

      console.log('Optimization completed successfully:', result);
      setOptimizationResult(result);
      setGenerationData(result.generationData);
    } catch (error) {
      console.error('Optimization failed:', error);
      alert('Optimization failed: ' + String(error));
    } finally {
      setIsOptimizing(false);
    }
  };

  const exportTimetable = () => {
    if (!optimizationResult || !optimizationData) return;

    const csvContent = [
      ['Day', 'Time', 'Course', 'Teacher', 'Room', 'Students'].join(','),
      ...optimizationResult.schedule.map(cls => {
        const course = optimizationData.courses.find(c => c.id === cls.courseId);
        const teacher = optimizationData.teachers.find(t => t.id === cls.teacherId);
        const room = optimizationData.rooms.find(r => r.id === cls.roomId);
        
        return [
          cls.day,
          `${cls.startTime}-${cls.endTime}`,
          course?.name || 'Unknown',
          teacher?.name || 'Unknown',
          room?.name || 'Unknown',
          course?.studentsCount || '0'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'timetable.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const NavButton = ({ id, label, icon: Icon, active }: { id: string; label: string; icon: any; active: boolean }) => (
    <button
      onClick={() => setCurrentView(id as any)}
      disabled={!optimizationData && id !== 'input'}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-md'
          : optimizationData || id === 'input'
            ? 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-emerald-600 p-2 rounded-lg">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Smart Timetable Generator</h1>
                <p className="text-sm text-gray-500">Genetic Algorithm + CP-SAT Optimization</p>
              </div>
            </div>
            
            {optimizationResult && (
              <button
                onClick={exportTimetable}
                className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Download size={18} />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 py-4">
            <NavButton id="input" label="Data Input" icon={Settings} active={currentView === 'input'} />
            <NavButton id="results" label="Results" icon={Calendar} active={currentView === 'results'} />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'input' && (
          <DataInput 
            onDataSubmit={handleDataSubmit}
            initialData={optimizationData ? {
              courses: optimizationData.courses,
              teachers: optimizationData.teachers,
              rooms: optimizationData.rooms,
              subjects: optimizationData.subjects
            } : undefined}
          />
        )}

        {currentView === 'results' && (
          <>
            {isOptimizing ? (
              <OptimizationProgress
                progress={progress}
                generation={generation}
                totalGenerations={100}
                bestFitness={bestFitness}
                generationData={generationData}
                isRunning={isOptimizing}
              />
            ) : optimizationResult && optimizationData ? (
              <TimetableDisplay
                result={optimizationResult}
                courses={optimizationData.courses}
                teachers={optimizationData.teachers}
                rooms={optimizationData.rooms}
                subjects={optimizationData.subjects}
              />
            ) : optimizationData ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="text-gray-500 mb-4">
                  <Target size={48} className="mx-auto mb-4" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to Generate</h3>
                <p className="text-gray-600 mb-6">
                  Data has been submitted. Click "Generate Timetable" again to start optimization.
                </p>
                <button
                  onClick={() => startOptimization(optimizationData)}
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-700 transition-all"
                >
                  Start Optimization
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <Activity size={48} className="mx-auto mb-4" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Data Submitted</h3>
                <p className="text-gray-600">
                  Please go to Data Input and submit your course, teacher, and room information first.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2025 Smart Timetable Generator. Powered by Genetic Algorithms and CP-SAT Constraint Programming.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;