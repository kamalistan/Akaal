import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricCard({ title, value, icon: Icon, trend, trendValue, delay = 0 }) {
  const isPositive = trendValue >= 0;
  
  return (
    <motion.div 
      className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {/* Icon */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5 text-purple-400" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-4xl font-bold text-white mb-1">{value}</div>
      
      {/* Title */}
      <div className="text-purple-300 text-sm">{title}</div>
    </motion.div>
  );
}