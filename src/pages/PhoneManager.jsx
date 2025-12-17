import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import FavoritesManager from '@/components/dialer/FavoritesManager';
import PhoneDialer from '@/components/dialer/PhoneDialer';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Star, Clock, Settings, Plus } from 'lucide-react';
import { formatPhoneNumber, getCallDurationFormatted } from '@/utils/phoneUtils';
import { AnimatePresence } from 'framer-motion';

export default function PhoneManager() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showDialer, setShowDialer] = useState(false);

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

  const { data: favorites = [] } = useQuery({
    queryKey: ['dialerFavorites', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const { data, error } = await supabase
        .from('dialer_favorites')
        .select('*')
        .eq('user_email', currentUser.email)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.email,
  });

  const { data: callHistory = [] } = useQuery({
    queryKey: ['dialerCallHistory', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const { data, error } = await supabase
        .from('dialer_call_history')
        .select('*')
        .eq('user_email', currentUser.email)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.email,
  });

  const { data: recentNumbers = [] } = useQuery({
    queryKey: ['recentNumbers', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const { data, error } = await supabase
        .from('recent_numbers')
        .select('*')
        .eq('user_email', currentUser.email)
        .order('last_called_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.email,
  });

  const stats = {
    totalCalls: callHistory.length,
    completedCalls: callHistory.filter(c => c.status === 'completed').length,
    totalDuration: callHistory.reduce((sum, c) => sum + (c.duration || 0), 0),
    missedCalls: callHistory.filter(c => c.is_missed).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />

        <div className="mb-6">
          <TabNav />
        </div>

        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white">Phone Manager</h1>
            <p className="text-purple-300 mt-1">Manage contacts, view history, and make calls</p>
          </div>
          <Button
            onClick={() => setShowDialer(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-lg"
          >
            <Phone className="w-4 h-4 mr-2" />
            Open Dialer
          </Button>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-300 text-sm">Total Calls</span>
              <Phone className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalCalls}</p>
          </div>

          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-300 text-sm">Completed</span>
              <Phone className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.completedCalls}</p>
          </div>

          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-300 text-sm">Total Time</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">{getCallDurationFormatted(stats.totalDuration)}</p>
          </div>

          <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-300 text-sm">Favorites</span>
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white">{favorites.length}</p>
          </div>
        </motion.div>

        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="bg-[#2d1f4a]/50 backdrop-blur-sm border border-purple-500/20 mb-6">
            <TabsTrigger value="favorites" className="data-[state=active]:bg-purple-600">
              <Star className="w-4 h-4 mr-2" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="recent" className="data-[state=active]:bg-purple-600">
              <Clock className="w-4 h-4 mr-2" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-purple-600">
              <Phone className="w-4 h-4 mr-2" />
              Call History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="favorites">
            <motion.div
              className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FavoritesManager userEmail={currentUser?.email} favorites={favorites} />
            </motion.div>
          </TabsContent>

          <TabsContent value="recent">
            <motion.div
              className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Recent Numbers</h3>
              <div className="space-y-2">
                {recentNumbers.length === 0 ? (
                  <div className="text-center py-12 text-purple-300">
                    <Clock className="w-12 h-12 mx-auto mb-2 text-purple-500/30" />
                    <p>No recent calls</p>
                  </div>
                ) : (
                  recentNumbers.map((recent) => (
                    <motion.div
                      key={recent.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-[#1a0f2e]/50 hover:bg-[#1a0f2e] transition-colors"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div>
                        <div className="font-medium text-white">
                          {recent.contact_name || formatPhoneNumber(recent.phone_number)}
                        </div>
                        <div className="text-sm text-purple-300">
                          Called {recent.call_count} time{recent.call_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowDialer(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="history">
            <motion.div
              className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Call History</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {callHistory.length === 0 ? (
                  <div className="text-center py-12 text-purple-300">
                    <Phone className="w-12 h-12 mx-auto mb-2 text-purple-500/30" />
                    <p>No call history</p>
                  </div>
                ) : (
                  callHistory.map((call) => (
                    <motion.div
                      key={call.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-[#1a0f2e]/50 hover:bg-[#1a0f2e] transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        call.direction === 'inbound' ? 'bg-blue-500/20' : 'bg-green-500/20'
                      }`}>
                        <Phone className={`w-5 h-5 ${
                          call.direction === 'inbound' ? 'text-blue-400 rotate-180' : 'text-green-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {call.contact_name || formatPhoneNumber(call.phone_number)}
                        </div>
                        <div className="text-sm text-purple-300">
                          {call.status === 'completed' ? (
                            <>Duration: {getCallDurationFormatted(call.duration)}</>
                          ) : (
                            <>Status: {call.status}</>
                          )}
                          {call.is_missed && <span className="text-red-400 ml-2">(Missed)</span>}
                        </div>
                      </div>
                      <div className="text-right text-sm text-purple-400 flex-shrink-0">
                        <div>{new Date(call.started_at).toLocaleDateString()}</div>
                        <div>{new Date(call.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      <AnimatePresence>
        {showDialer && (
          <PhoneDialer
            onClose={() => setShowDialer(false)}
            userEmail={currentUser?.email}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
