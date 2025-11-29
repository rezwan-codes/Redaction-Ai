import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ProcessingStats } from '../types';

interface AccuracyMetricProps {
  stats: ProcessingStats | null;
}

const AccuracyMetric: React.FC<AccuracyMetricProps> = ({ stats }) => {
  if (!stats) return null;

  const hasAccuracy = stats.accuracyScore !== undefined;

  // If we have an expected output (accuracyScore), we show Accuracy.
  // Otherwise, we show Privacy Impact (Similarity to Original).
  
  const score = hasAccuracy ? stats.accuracyScore! : stats.similarityScore;
  const title = hasAccuracy ? "Evaluation Accuracy" : "Privacy Impact Score";
  const subLabel = hasAccuracy ? "Match with Ground Truth" : "Levenshtein Similarity";
  
  const data = [
    { name: hasAccuracy ? 'Matched' : 'Identity Preserved', value: score },
    { name: hasAccuracy ? 'Mismatch' : 'Redacted/Changed', value: 100 - score },
  ];

  // Colors: Green for good match (high score), Red for bad.
  // For Privacy Impact: High similarity means less redaction (maybe warning?), but usually we track similarity as "content preserved".
  // Let's keep the existing colors for Privacy Impact, and use similar for Accuracy.
  const COLORS = ['#10B981', '#EF4444']; // Emerald-500, Red-500

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col items-center justify-center">
      <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wider mb-4">{title}</h3>
      
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
              itemStyle={{ color: '#f1f5f9' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-center">
        <div className="text-3xl font-bold text-white">
          {score.toFixed(1)}%
        </div>
        <p className="text-xs text-slate-400 mt-1">{subLabel}</p>
      </div>
      
      <div className="w-full mt-6 grid grid-cols-2 gap-4 border-t border-slate-700 pt-4">
        <div className="text-center">
          <p className="text-xl font-mono text-cyan-400">{stats.entityCount}</p>
          <p className="text-xs text-slate-500">Entities Found</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-mono text-purple-400">{stats.levenshteinDistance}</p>
          <p className="text-xs text-slate-500">Edit Distance</p>
        </div>
      </div>
    </div>
  );
};

export default AccuracyMetric;