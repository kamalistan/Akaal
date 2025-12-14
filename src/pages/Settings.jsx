import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Target, LogOut, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Settings() {
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

  const handleLogout = () => {
    // Mock logout - redirect or clear session as needed
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] p-6">
      <div className="max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        <div className="mb-6">
          <TabNav />
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Section */}
          <motion.div 
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-purple-300 text-sm mb-2 block">Name</label>
                <Input 
                  value={currentUser?.full_name || ''} 
                  disabled
                  className="bg-[#1a0f2e] border-purple-500/20 text-white"
                />
              </div>
              <div>
                <label className="text-purple-300 text-sm mb-2 block">Email</label>
                <Input 
                  value={currentUser?.email || ''} 
                  disabled
                  className="bg-[#1a0f2e] border-purple-500/20 text-white"
                />
              </div>
            </div>
          </motion.div>

          {/* Goals Section */}
          <motion.div 
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Daily Goals</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-purple-300 text-sm mb-2 block">Daily Call Goal</label>
                <Input 
                  type="number"
                  value={userStats?.daily_goal || 50} 
                  disabled
                  className="bg-[#1a0f2e] border-purple-500/20 text-white"
                />
              </div>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div 
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <LinkIcon className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Quick Links</h2>
            </div>
            <div className="space-y-3">
              <Link 
                to={createPageUrl('Leads')}
                className="block w-full p-4 bg-[#1a0f2e] rounded-xl border border-purple-500/10 hover:border-purple-500/30 transition-all"
              >
                <p className="text-white font-medium">Manage Leads</p>
                <p className="text-purple-400 text-sm">Add and organize your leads</p>
              </Link>
            </div>
          </motion.div>

          {/* Logout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full h-14 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-2xl"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}