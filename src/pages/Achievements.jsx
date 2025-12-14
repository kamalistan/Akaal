import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import { Trophy, Star, Zap, Target, Award, Medal, Phone, Flame, Swords, Crown, CalendarCheck, Rocket, Gem, Shield, TrendingUp } from 'lucide-react';

const achievements = [
  { id: 1, name: 'First Blood', desc: 'Make your very first call', icon: Swords, requirement: 1, field: 'calls_today', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { id: 2, name: 'The Talker', desc: 'Make 10 calls in a day', icon: Phone, requirement: 10, field: 'calls_today', color: 'text-sky-400', bgColor: 'bg-sky-500/10' },
  { id: 3, name: 'Call King', desc: 'Make 50 calls in a day', icon: Crown, requirement: 50, field: 'calls_today', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  { id: 4, name: 'Appointment Maker', desc: 'Book your first appointment', icon: CalendarCheck, requirement: 1, field: 'appointments_today', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  { id: 5, name: 'Streak Starter', desc: 'Achieve a 3-day call streak', icon: Flame, requirement: 3, field: 'current_streak', color: 'text-red-400', bgColor: 'bg-red-500/10' },
  { id: 6, name: 'Unstoppable', desc: 'Achieve a 7-day call streak', icon: Rocket, requirement: 7, field: 'current_streak', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { id: 7, name: 'Point Collector', desc: 'Earn 500 points', icon: Gem, requirement: 500, field: 'total_points', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  { id: 8, name: 'Grand Master', desc: 'Earn 2000 points', icon: Shield, requirement: 2000, field: 'total_points', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
  { id: 9, name: 'Level Up!', desc: 'Reach Level 3', icon: TrendingUp, requirement: 3, field: 'level', color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
  { id: 10, name: 'Legendary Closer', desc: 'Reach Level 5', icon: Crown, requirement: 5, field: 'level', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
];

export default function Achievements() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = { email: 'demo@example.com' };
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const { data: userStats } = useQuery({
    queryKey: ['userStats', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const { data: stats, error } = await supabase
        .from('user_stats')
        .select()
        .eq('user_email', currentUser.email)
        .maybeSingle();

      if (error) throw error;
      return stats || null;
    },
    enabled: !!currentUser?.email,
  });

  const isAchievementUnlocked = (achievement) => {
    if (!userStats) return false;
    return (userStats[achievement.field] || 0) >= achievement.requirement;
  };

  const getProgress = (achievement) => {
    if (!userStats) return 0;
    const current = userStats[achievement.field] || 0;
    return Math.min((current / achievement.requirement) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] p-6">
      <div className="max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        <div className="mb-6">
          <TabNav />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement, index) => {
            const Icon = achievement.icon;
            const unlocked = isAchievementUnlocked(achievement);
            const progress = getProgress(achievement);

            return (
              <motion.div
                key={achievement.id}
                className={`
                  bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border 
                  ${unlocked ? 'border-amber-500/50 shadow-lg shadow-amber-500/20' : 'border-purple-500/20'}
                  relative overflow-hidden
                `}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {unlocked && (
                  <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                      <Star className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                )}

                <div className={`w-16 h-16 ${achievement.bgColor} rounded-2xl flex items-center justify-center mb-4`}>
                  <Icon className={`w-8 h-8 ${unlocked ? achievement.color : 'text-purple-600/50'}`} />
                </div>

                <h3 className={`text-xl font-bold mb-2 ${unlocked ? 'text-white' : 'text-purple-300'}`}>
                  {achievement.name}
                </h3>
                <p className="text-purple-400 text-sm mb-4">{achievement.desc}</p>

                <div className="w-full h-2 bg-[#1a0f2e] rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${unlocked ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-purple-500 to-indigo-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>
                <p className="text-purple-400 text-xs mt-2">
                  {unlocked ? 'Unlocked!' : `${userStats?.[achievement.field] || 0} / ${achievement.requirement}`}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}