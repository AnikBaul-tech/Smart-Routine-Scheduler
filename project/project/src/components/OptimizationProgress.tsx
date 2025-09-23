import { FC } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GenerationData } from '../types/timetable';
import { Activity, Zap, Target } from 'lucide-react';

interface OptimizationProgressProps {
  progress: number;
  generation: number;
  totalGenerations: number;
  bestFitness: number;
  generationData: GenerationData[];
  isRunning: boolean;
}

export const OptimizationProgress: FC<OptimizationProgressProps> = ({
  progress,
  generation,
  totalGenerations,
  bestFitness,
  generationData,
  isRunning
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">Optimization Progress</h3>
        <div className="flex items-center space-x-4">
          {isRunning && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm font-medium">Optimizing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm text-gray-600">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-blue-600 to-emerald-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-gray-700">Generation</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {generation} / {totalGenerations}
          </div>
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="text-emerald-600" size={20} />
            <span className="text-sm font-medium text-gray-700">Best Fitness</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {bestFitness.toFixed(0)}
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="text-orange-600" size={20} />
            <span className="text-sm font-medium text-gray-700">Improvement</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {generationData.length > 1 
              ? ((bestFitness - generationData[0].bestFitness) / generationData[0].bestFitness * 100).toFixed(1)
              : '0.0'
            }%
          </div>
        </div>
      </div>

      {/* Fitness Evolution Chart */}
      {generationData.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Fitness Evolution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={generationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="generation" 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="bestFitness" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  name="Best Fitness"
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="averageFitness" 
                  stroke="#059669" 
                  strokeWidth={2}
                  name="Average Fitness"
                  dot={{ fill: '#059669', strokeWidth: 2, r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="worstFitness" 
                  stroke="#ea580c" 
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Worst Fitness"
                  dot={{ fill: '#ea580c', strokeWidth: 2, r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Algorithm Status */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-semibold text-gray-800">Algorithm Status</h5>
            <p className="text-sm text-gray-600">
              {isRunning 
                ? `Running hybrid optimization (GA + CP-SAT)...` 
                : progress === 100 
                  ? 'Optimization completed successfully!' 
                  : 'Ready to optimize'
              }
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isRunning 
              ? 'bg-blue-100 text-blue-800' 
              : progress === 100 
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            {isRunning ? 'Running' : progress === 100 ? 'Completed' : 'Idle'}
          </div>
        </div>
      </div>
    </div>
  );
};