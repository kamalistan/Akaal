import React from 'react';
import { motion } from 'framer-motion';

export default function LevelProgress({ level = 1, currentXP = 0, nextLevelXP = 500 }) {
  const progress = (currentXP / nextLevelXP) * 100;

  return (
    <motion.div 
      className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-purple-300 font-semibold">Level {level}</span>
        <span className="text-purple-400 text-sm">{currentXP} / {nextLevelXP} XP</span>
      </div>
      <div className="w-full h-3 bg-[#1a0f2e] rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/50"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}