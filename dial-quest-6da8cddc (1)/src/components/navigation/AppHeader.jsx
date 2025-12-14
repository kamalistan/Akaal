import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Flame } from 'lucide-react';

export default function AppHeader({ userStats }) {
  const level = userStats?.level || 1;
  const xpCurrent = userStats?.total_points || 0;
  const xpNeeded = level * 500;
  const xpProgress = (xpCurrent % xpNeeded) / xpNeeded * 100;
  
  const calls = userStats?.calls_today || 0;
  const appointments = userStats?.appointments_today || 0;
  const streak = userStats?.current_streak || 0;

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Left - Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Zap className="w-6 h-6 text-white fill-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Akaal</h1>
          <div className="flex items-center gap-2 text-purple-300 text-sm">
            <span>Level {level} Closer</span>
            <span className="text-purple-500">•</span>
            <span>{xpCurrent} / {xpNeeded} XP</span>
          </div>
        </div>
      </div>

      {/* Right - Quick Stats */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-purple-400 text-xs mb-1">Calls</div>
          <div className="text-2xl font-bold text-white">{calls}</div>
        </div>
        <div className="text-center">
          <div className="text-purple-400 text-xs mb-1">Appointments</div>
          <div className="text-2xl font-bold text-white">{appointments}</div>
        </div>
        <div className="text-center">
          <div className="text-purple-400 text-xs mb-1">Streak</div>
          <div className="text-2xl font-bold text-white flex items-center gap-1">
            {streak}
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
        </div>
      </div>
    </div>
  );
}