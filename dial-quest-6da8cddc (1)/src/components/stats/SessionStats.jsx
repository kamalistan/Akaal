import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Calendar, TrendingUp, DollarSign } from 'lucide-react';

export default function SessionStats({ stats }) {
  const calls = stats?.calls_today || 0;
  const appointments = stats?.appointments_today || 0;
  const conversionRate = calls > 0 ? ((appointments / calls) * 100).toFixed(1) : 0.0;
  
  const statItems = [
    { 
      label: 'Total Calls', 
      value: calls, 
      icon: Phone, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10' 
    },
    { 
      label: 'Appointments', 
      value: appointments, 
      icon: Calendar, 
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10' 
    },
    { 
      label: 'Conversion Rate', 
      value: `${conversionRate}%`, 
      icon: TrendingUp, 
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10' 
    },
    { 
      label: 'Pipeline Value', 
      value: `$${(appointments * 35000).toLocaleString()}`, 
      icon: DollarSign, 
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10' 
    },
  ];

  return (
    <motion.div 
      className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-bold text-white">Session Stats</h3>
      </div>

      <div className="space-y-4">
        {statItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              className="flex items-center justify-between p-4 bg-[#1a0f2e] rounded-2xl border border-purple-500/10"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${item.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <span className="text-purple-300 text-sm">{item.label}</span>
              </div>
              <span className="text-2xl font-bold text-white">{item.value}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}