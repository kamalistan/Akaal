import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Flame, Phone, CalendarCheck, TrendingUp, Users, Target, Award } from 'lucide-react';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';

const rankColors = {
  0: { bg: 'bg-gradient-to-br from-yellow-400 to-amber-500', text: 'text-yellow-600', ring: 'ring-yellow-400' },
  1: { bg: 'bg-gradient-to-br from-slate-300 to-slate-400', text: 'text-slate-500', ring: 'ring-slate-300' },
  2: { bg: 'bg-gradient-to-br from-amber-600 to-orange-700', text: 'text-amber-700', ring: 'ring-amber-500' },
};

export default function Leaderboard() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const { data: userStats } = useQuery({
    queryKey: ['userStats', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const stats = await base44.entities.UserStats.filter({ user_email: currentUser.email });
      if (stats.length === 0) {
        const newStats = await base44.entities.UserStats.create({
          user_email: currentUser.email,
          total_points: 0,
          level: 1,
          calls_today: 0,
          appointments_today: 0,
          current_streak: 0,
          best_streak: 0,
          daily_goal: 50,
          mascot_mood: 'neutral'
        });
        return newStats;
      }
      return stats[0];
    },
    enabled: !!currentUser?.email,
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => base44.entities.UserStats.list('-total_points'),
  });

  const topThree = allStats.slice(0, 3);
  const rest = allStats.slice(3);

  // Calculate team-wide statistics
  const teamStats = {
    totalCalls: allStats.reduce((sum, stat) => sum + (stat.calls_today || 0), 0),
    totalAppointments: allStats.reduce((sum, stat) => sum + (stat.appointments_today || 0), 0),
    totalPoints: allStats.reduce((sum, stat) => sum + (stat.total_points || 0), 0),
    averageStreak: allStats.length > 0 
      ? (allStats.reduce((sum, stat) => sum + (stat.current_streak || 0), 0) / allStats.length).toFixed(1)
      : 0,
    teamMembers: allStats.length,
    topPerformer: allStats[0]?.user_email?.split('@')[0] || 'N/A',
    conversionRate: allStats.reduce((sum, stat) => sum + (stat.calls_today || 0), 0) > 0
      ? ((allStats.reduce((sum, stat) => sum + (stat.appointments_today || 0), 0) / 
          allStats.reduce((sum, stat) => sum + (stat.calls_today || 0), 0)) * 100).toFixed(1)
      : 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] p-6">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        
        <div className="mb-6">
          <TabNav />
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div 
            className="mb-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-500" />
              Team Leaderboard
            </h1>
            <p className="text-purple-300 mt-1">Rankings and performance metrics</p>
          </motion.div>

          {/* Team Stats Overview */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-5 h-5 text-indigo-400" />
                <span className="text-purple-300 text-sm">Total Calls</span>
              </div>
              <p className="text-3xl font-bold text-white">{teamStats.totalCalls}</p>
              <p className="text-xs text-purple-400 mt-1">{teamStats.teamMembers} members</p>
            </div>

            <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-2">
                <CalendarCheck className="w-5 h-5 text-green-400" />
                <span className="text-purple-300 text-sm">Appointments</span>
              </div>
              <p className="text-3xl font-bold text-white">{teamStats.totalAppointments}</p>
              <p className="text-xs text-purple-400 mt-1">{teamStats.conversionRate}% conversion</p>
            </div>

            <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span className="text-purple-300 text-sm">Total Points</span>
              </div>
              <p className="text-3xl font-bold text-white">{teamStats.totalPoints.toLocaleString()}</p>
              <p className="text-xs text-purple-400 mt-1">Team score</p>
            </div>

            <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-purple-300 text-sm">Avg Streak</span>
              </div>
              <p className="text-3xl font-bold text-white">{teamStats.averageStreak}</p>
              <p className="text-xs text-purple-400 mt-1">days active</p>
            </div>
          </motion.div>

        {/* Podium */}
        <motion.div 
          className="flex items-end justify-center gap-4 mb-12 h-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* 2nd Place */}
          {topThree[1] && (
            <motion.div 
              className="flex flex-col items-center"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className={`w-20 h-20 rounded-full ${rankColors[1].bg} flex items-center justify-center text-white text-2xl font-bold shadow-xl mb-3 ring-4 ${rankColors[1].ring}`}>
                {topThree[1].user_email?.[0]?.toUpperCase() || '2'}
              </div>
              <p className="font-semibold text-white text-sm truncate max-w-24">
                {topThree[1].user_email?.split('@')[0]}
              </p>
              <p className="text-lg font-bold text-white">{topThree[1].total_points?.toLocaleString()}</p>
              <div className="w-28 h-32 bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-xl mt-3 flex items-center justify-center">
                <span className="text-4xl font-bold text-slate-400">2</span>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {topThree[0] && (
            <motion.div 
              className="flex flex-col items-center"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className={`w-24 h-24 rounded-full ${rankColors[0].bg} flex items-center justify-center text-white text-3xl font-bold shadow-2xl mb-3 ring-4 ${rankColors[0].ring}`}>
                  {topThree[0].user_email?.[0]?.toUpperCase() || '1'}
                </div>
              </motion.div>
              <p className="font-semibold text-white truncate max-w-28">
                {topThree[0].user_email?.split('@')[0]}
              </p>
              <p className="text-xl font-bold text-white">{topThree[0].total_points?.toLocaleString()}</p>
              <div className="w-32 h-44 bg-gradient-to-t from-amber-500 to-yellow-500 rounded-t-xl mt-3 flex items-center justify-center shadow-lg">
                <span className="text-5xl font-bold text-amber-900">1</span>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {topThree[2] && (
            <motion.div 
              className="flex flex-col items-center"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className={`w-18 h-18 rounded-full ${rankColors[2].bg} flex items-center justify-center text-white text-xl font-bold shadow-xl mb-3 ring-4 ${rankColors[2].ring}`}>
                {topThree[2].user_email?.[0]?.toUpperCase() || '3'}
              </div>
              <p className="font-semibold text-white text-sm truncate max-w-24">
                {topThree[2].user_email?.split('@')[0]}
              </p>
              <p className="text-lg font-bold text-white">{topThree[2].total_points?.toLocaleString()}</p>
              <div className="w-28 h-24 bg-gradient-to-t from-orange-700 to-amber-700 rounded-t-xl mt-3 flex items-center justify-center">
                <span className="text-4xl font-bold text-orange-400">3</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Rest of leaderboard */}
        {rest.length > 0 && (
          <motion.div 
            className="bg-[#2d1f4a]/50 backdrop-blur-xl rounded-3xl border border-purple-500/20 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {rest.map((stat, index) => {
              const isCurrentUser = stat.user_email === currentUser?.email;
              return (
                <motion.div
                  key={stat.id}
                  className={`flex items-center p-4 border-b border-purple-500/10 last:border-0 ${isCurrentUser ? 'bg-purple-900/30' : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                >
                  <span className="w-8 text-lg font-bold text-purple-400">{index + 4}</span>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold mr-4">
                    {stat.user_email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">
                      {stat.user_email?.split('@')[0]}
                      {isCurrentUser && <span className="text-purple-400 ml-2">(You)</span>}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-purple-300 mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {stat.calls_today || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3" />
                        {stat.appointments_today || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {stat.current_streak || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-purple-400" />
                        Lvl {stat.level || 1}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{stat.total_points?.toLocaleString()}</p>
                    <p className="text-sm text-purple-400">XP</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {allStats.length === 0 && (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Trophy className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
            <p className="text-purple-300">Start making calls to appear on the leaderboard!</p>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
}