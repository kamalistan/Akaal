import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import LeadCard from '@/components/dialer/LeadCard';
import SessionStats from '@/components/stats/SessionStats';
import LevelProgress from '@/components/level/LevelProgress';
import DialerModal from '@/components/dialer/DialerModal';
import PointsPopup from '@/components/dialer/PointsPopup';
import AIPerformanceCoach from '@/components/ai/AIPerformanceCoach';
import SessionRecoveryModal from '@/components/dialer/SessionRecoveryModal';
import DialerFAB from '@/components/dialer/DialerFAB';
import { createSessionManager } from '@/utils/sessionManager';
import { Link as LinkIcon, Filter, BarChart3, PhoneCall, Zap, ArrowRight } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useTheme } from '@/contexts/ThemeContext';

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  const [showPoints, setShowPoints] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [selectedPipeline, setSelectedPipeline] = useState('all');
  const [activeSession, setActiveSession] = useState(null);
  const [showSessionRecovery, setShowSessionRecovery] = useState(false);
  const [sessionLeads, setSessionLeads] = useState([]);
  const sessionManager = useRef(null);
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  useEffect(() => {
    const loadUser = async () => {
      const user = { email: 'demo@example.com' };
      setCurrentUser(user);
      sessionManager.current = createSessionManager(user.email);

      const existingSession = await sessionManager.current.getActiveSession();
      if (existingSession) {
        setActiveSession(existingSession);
        setShowSessionRecovery(true);
      }
    };
    loadUser();

    return () => {
      if (sessionManager.current) {
        sessionManager.current.cleanup();
      }
    };
  }, []);

  // Get or create user stats
  const { data: userStats } = useQuery({
    queryKey: ['userStats', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const { data: stats, error } = await supabase
        .from('user_stats')
        .select()
        .eq('user_email', currentUser.email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (!stats) {
        const { data: newStats, error: createError } = await supabase
          .from('user_stats')
          .insert({
            user_email: currentUser.email,
            total_points: 0,
            level: 1,
            calls_today: 0,
            appointments_today: 0,
            current_streak: 0,
            best_streak: 0,
            daily_goal: 50,
            mascot_mood: 'neutral'
          })
          .select()
          .single();

        if (createError) throw createError;
        return newStats;
      }
      return stats;
    },
    enabled: !!currentUser?.email,
  });

  // Get pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ghl_pipelines')
        .select('*')
        .order('name');

      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },
  });

  // Get available leads
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', selectedPipeline],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          *,
          pipeline:ghl_pipelines(id, name)
        `)
        .eq('status', 'new');

      if (selectedPipeline !== 'all') {
        if (selectedPipeline === 'none') {
          query = query.is('pipeline_id', null);
        } else {
          query = query.eq('pipeline_id', selectedPipeline);
        }
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  // Get recent call logs for analytics
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['recentCalls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },
  });

  const startDialing = (lead) => {
    if (lead) {
      setCurrentLead(lead);
      setShowDialer(true);
    } else if (leads.length > 0) {
      setCurrentLead(leads[0]);
      setShowDialer(true);
    }
  };

  const skipToNextLead = () => {
    if (!currentLead || leads.length <= 1) return;

    const currentIndex = leads.findIndex(l => l.id === currentLead.id);
    const nextIndex = (currentIndex + 1) % leads.length;
    setCurrentLead(leads[nextIndex]);
  };

  const skipToPrevLead = () => {
    if (!currentLead || leads.length <= 1) return;

    const currentIndex = leads.findIndex(l => l.id === currentLead.id);
    const prevIndex = currentIndex === 0 ? leads.length - 1 : currentIndex - 1;
    setCurrentLead(leads[prevIndex]);
  };

  const handleCallComplete = async (points, sessionId) => {
    setShowDialer(false);
    setEarnedPoints(points);
    setShowPoints(true);
    queryClient.invalidateQueries(['userStats']);
    queryClient.invalidateQueries(['leads']);

    if (sessionManager.current && sessionId) {
      await sessionManager.current.updateSession({
        completed_leads: (activeSession?.completed_leads || 0) + 1,
      });
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession || !sessionManager.current) return;

    setShowSessionRecovery(false);

    const leads = await sessionManager.current.getSessionLeads(activeSession);
    setSessionLeads(leads);

    const currentIndex = activeSession.current_lead_index || 0;
    if (leads[currentIndex]) {
      setCurrentLead(leads[currentIndex]);
      setSelectedPipeline(activeSession.pipeline_id || 'all');
      setShowDialer(true);
    }
  };

  const handleDiscardSession = async () => {
    if (sessionManager.current && activeSession) {
      await sessionManager.current.endSession();
    }
    setActiveSession(null);
    setShowSessionRecovery(false);
  };

  const level = userStats?.level || 1;
  const currentXP = userStats?.total_points || 0;
  const nextLevelXP = level * 500;

  const callsByOutcome = recentCalls.reduce((acc, call) => {
    acc[call.outcome] = (acc[call.outcome] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.background} relative overflow-hidden`}>
      {/* Ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${theme.primaryGlow} rounded-full blur-3xl`} />
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${theme.secondaryGlow} rounded-full blur-3xl`} />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        
        <div className="mb-6">
          <TabNav />
        </div>

        {/* Pipeline Filter - Minimalistic */}
        {pipelines.length > 0 && (
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-purple-400" />
              <select
                value={selectedPipeline}
                onChange={(e) => setSelectedPipeline(e.target.value)}
                className={`px-4 py-2 ${theme.cardBg} backdrop-blur-sm border ${theme.borderColor} rounded-xl ${theme.textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-${theme.accentColor}-500`}
              >
                <option value="all">All Leads</option>
                <option value="none">No Pipeline</option>
                {pipelines.map(pipeline => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}

        {/* Call Analytics Summary */}
        <motion.div
          className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={`${theme.cardBg} backdrop-blur-sm rounded-2xl p-4 border border-emerald-500/20`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-300 text-sm">Appointments</span>
              <PhoneCall className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{callsByOutcome.appointment_set || 0}</p>
          </div>
          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-4 border border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-300 text-sm">Callbacks</span>
              <PhoneCall className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{callsByOutcome.callback || 0}</p>
          </div>
          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">No Answer</span>
              <PhoneCall className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-white">{callsByOutcome.no_answer || 0}</p>
          </div>
          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-300 text-sm">Total Calls</span>
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">{recentCalls.length}</p>
          </div>
        </motion.div>

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
              onStartCall={() => startDialing(leads[0])}
              xpMultiplier={userStats?.current_streak >= 3 ? 2 : 1}
            />

            {/* AI Performance Coach */}
            <AIPerformanceCoach />
            </div>

          {/* Right column - Session Stats & Level Info */}
          <div className="space-y-6">
            <SessionStats stats={userStats} />

            {/* Triple-Line Dialer Promo */}
            <motion.div
              className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-3xl p-6 border border-cyan-500/30"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Triple-Line Power Dialer</h3>
                  <p className="text-cyan-200 text-sm">Call 3 leads at once, connect only to humans</p>
                </div>
              </div>
              <div className="space-y-2 mb-4 text-sm text-cyan-100">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>3x faster contact rate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Auto-skip voicemails with AMD</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Talk only to real humans</span>
                </div>
              </div>
              <Link to={createPageUrl('TripleLineDialing')}>
                <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                  Try Triple-Line Dialer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </motion.div>

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
            onNext={skipToNextLead}
            onPrev={skipToPrevLead}
            hasNext={leads.length > 1}
            hasPrev={leads.length > 1}
            sessionId={activeSession?.id}
            sessionManager={sessionManager.current}
          />
        )}
      </AnimatePresence>

      {/* Points Popup */}
      <PointsPopup
        points={earnedPoints}
        isVisible={showPoints}
        onComplete={() => setShowPoints(false)}
      />

      {/* Session Recovery Modal */}
      <SessionRecoveryModal
        session={activeSession}
        onResume={handleResumeSession}
        onDiscard={handleDiscardSession}
        open={showSessionRecovery}
      />

      {/* Phone Dialer FAB */}
      <DialerFAB userEmail={currentUser?.email} />
    </div>
  );
}