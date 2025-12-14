import React from 'react';
import { motion } from 'framer-motion';
import { Users, LayoutGrid, Home, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function TopBar({ userName, dailyProgress, dailyGoal }) {
  const progress = Math.min((dailyProgress / dailyGoal) * 100, 100);
  
  return (
    <motion.div 
      className="flex items-center justify-between px-6 py-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
          <span className="text-white font-bold text-xl">D</span>
        </div>
        <h1 className="text-slate-700 text-lg font-medium">
          Welcome back, <span className="font-semibold">{userName || 'Player'}!</span>
        </h1>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-4 flex-1 max-w-md mx-8">
        <div className="flex-1 h-3 bg-white/50 rounded-full overflow-hidden shadow-inner">
          <motion.div 
            className="h-full bg-gradient-to-r from-lime-400 to-green-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <span className="text-slate-600 font-medium text-sm whitespace-nowrap">
          {dailyProgress}/{dailyGoal}
        </span>
      </div>

      {/* Navigation icons */}
      <div className="flex items-center gap-2">
        <Link 
          to={createPageUrl('Leads')}
          className="p-2.5 hover:bg-white/50 rounded-xl transition-all"
        >
          <Users className="w-5 h-5 text-slate-600" />
        </Link>
        <Link 
          to={createPageUrl('Leaderboard')}
          className="p-2.5 hover:bg-white/50 rounded-xl transition-all"
        >
          <LayoutGrid className="w-5 h-5 text-slate-600" />
        </Link>
        <Link 
          to={createPageUrl('Home')}
          className="p-2.5 hover:bg-white/50 rounded-xl transition-all"
        >
          <Home className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="ml-2 w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
          <User className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
}