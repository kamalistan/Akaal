import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import LeadCard from '@/components/dialer/LeadCard';
import SessionStats from '@/components/stats/SessionStats';
import LevelProgress from '@/components/level/LevelProgress';
import DialerModal from '@/components/dialer/DialerModal';
import PointsPopup from '@/components/dialer/PointsPopup';
import AIPerformanceCoach from '@/components/ai/AIPerformanceCoach';
import { Link as LinkIcon } from 'lucide-react';

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  const [showPoints, setShowPoints] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  // Get or create user stats
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

  // Get available leads
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.filter({ status: 'new' }, '-created_date', 100),
  });

  const startDialing = () => {
    if (leads.length > 0) {
      const randomLead = leads[Math.floor(Math.random() * leads.length)];
      setCurrentLead(randomLead);
      setShowDialer(true);
    }
  };

  const handleCallComplete = (points) => {
    setShowDialer(false);
    setEarnedPoints(points);
    setShowPoints(true);
    queryClient.invalidateQueries(['userStats']);
    queryClient.invalidateQueries(['leads']);
  };

  const level = userStats?.level || 1;
  const currentXP = userStats?.total_points || 0;
  const nextLevelXP = level * 500;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        
        <div className="mb-6">
          <TabNav />
        </div>

        {/* Level Progress */}
        <div className="mb-6">
          <LevelProgress 
            level={level} 
            currentXP={currentXP % nextLevelXP} 
            nextLevelXP={nextLevelXP} 
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Lead Card */}
          <div className="lg:col-span-2">
            <LeadCard 
              lead={leads[0]} 
              onStartCall={startDialing}
              xpMultiplier={userStats?.current_streak >= 3 ? 2 : 1}
            />

            {/* AI Performance Coach */}
            <AIPerformanceCoach />
            </div>

          {/* Right column - Session Stats & Level Info */}
          <div className="space-y-6">
            <SessionStats stats={userStats} />
            
            {/* Level Details */}
            <motion.div 
              className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-bold text-white mb-4">Level {level}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-xl">
                  <span className="text-purple-300 text-sm">Current XP</span>
                  <span className="text-white font-semibold">{currentXP % nextLevelXP}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-xl">
                  <span className="text-purple-300 text-sm">Next Level</span>
                  <span className="text-white font-semibold">{nextLevelXP}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Dialer Modal */}
      <AnimatePresence>
        {showDialer && currentLead && (
          <DialerModal
            lead={currentLead}
            userStats={userStats}
            onClose={() => setShowDialer(false)}
            onComplete={handleCallComplete}
          />
        )}
      </AnimatePresence>

      {/* Points Popup */}
      <PointsPopup 
        points={earnedPoints}
        isVisible={showPoints}
        onComplete={() => setShowPoints(false)}
      />
    </div>
  );
}