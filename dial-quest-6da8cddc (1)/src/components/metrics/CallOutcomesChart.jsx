import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  'appointment_set': '#10b981',
  'callback': '#8b5cf6',
  'voicemail': '#f59e0b',
  'no_answer': '#6b7280',
  'not_interested': '#ef4444',
  'wrong_number': '#ec4899'
};

const LABELS = {
  'appointment_set': 'Success',
  'callback': 'Callback',
  'voicemail': 'Voicemail',
  'no_answer': 'No Answer',
  'not_interested': 'Not Interested',
  'wrong_number': 'Wrong Number'
};

export default function CallOutcomesChart({ data }) {
  const chartData = data.map(item => ({
    name: LABELS[item.outcome] || item.outcome,
    value: item.count,
    outcome: item.outcome
  }));

  return (
    <div className="w-full h-80 flex">
      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.outcome] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a0f2e', 
                border: '1px solid #6b21a8',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="w-48 flex flex-col justify-center space-y-3">
        {chartData.map((entry, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[entry.outcome] || '#6b7280' }}
              />
              <span className="text-purple-300 text-sm">{entry.name}</span>
            </div>
            <span className="text-white font-semibold text-sm">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}