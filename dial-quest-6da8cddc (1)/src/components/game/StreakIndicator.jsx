import React from 'react';
import { motion } from 'framer-motion';

const streakColors = [
  { bg: 'bg-emerald-400', shadow: 'shadow-emerald-400/50' },
  { bg: 'bg-sky-400', shadow: 'shadow-sky-400/50' },
  { bg: 'bg-yellow-400', shadow: 'shadow-yellow-400/50' },
  { bg: 'bg-orange-400', shadow: 'shadow-orange-400/50' },
  { bg: 'bg-red-400', shadow: 'shadow-red-400/50' },
  { bg: 'bg-purple-400', shadow: 'shadow-purple-400/50' },
];

export default function StreakIndicator({ streak = 0, maxStreak = 6 }) {
  const activeStreak = Math.min(streak, maxStreak);
  
  return (
    <div className="flex flex-col gap-3 p-3">
      {streakColors.map((color, index) => {
        const isActive = index < activeStreak;
        const reverseIndex = streakColors.length - 1 - index;
        
        return (
          <motion.div
            key={index}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isActive ? 1 : 0.8, 
              opacity: isActive ? 1 : 0.3 
            }}
            transition={{ 
              delay: reverseIndex * 0.1,
              type: "spring",
              stiffness: 200
            }}
            className={`
              w-4 h-4 rounded-full 
              ${isActive ? color.bg : 'bg-slate-300'}
              ${isActive ? `shadow-lg ${color.shadow}` : ''}
              transition-all duration-300
            `}
          />
        );
      })}
    </div>
  );
}