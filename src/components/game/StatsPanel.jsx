import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export default function StatsPanel({ stats }) {
  const { total_points = 0, calls_today = 0, daily_goal = 50, level = 1 } = stats || {};
  
  const callProgress = Math.min((calls_today / daily_goal) * 100, 100);
  const pointsToNextLevel = level * 500;
  const levelProgress = (total_points % pointsToNextLevel) / pointsToNextLevel * 100;
  
  const stars = Math.min(Math.floor(calls_today / 10), 5);

  return (
    <motion.div 
      className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 space-y-6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* Stars rating */}
      <div className="flex justify-center gap-1">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Star 
              className={`w-6 h-6 ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`}
            />
          </motion.div>
        ))}
      </div>

      {/* Points display */}
      <div className="text-center">
        <motion.div 
          className="text-5xl font-bold text-slate-800"
          key={total_points}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {total_points.toLocaleString()}
        </motion.div>
        <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${levelProgress}%` }}
            transition={{ duration: 1 }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">Level {level} • {pointsToNextLevel - (total_points % pointsToNextLevel)} pts to next</p>
      </div>

      {/* Calls today */}
      <div className="text-center">
        <motion.div 
          className="text-5xl font-bold text-slate-800"
          key={calls_today}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {calls_today}
        </motion.div>
        <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${callProgress}%` }}
            transition={{ duration: 1 }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">{calls_today}/{daily_goal} daily goal</p>
      </div>
    </motion.div>
  );
}