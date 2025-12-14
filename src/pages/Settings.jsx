import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Target, LogOut, Link as LinkIcon, Phone, Clock, Palette, Calendar, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Settings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [settings, setSettings] = useState({
    double_dial_enabled: false,
    max_dialing_lines: 1,
    auto_detect_voicemail: false,
    timezone_protection: true,
    timezone: 'America/New_York',
    calling_hours_start: '09:00',
    calling_hours_end: '17:00',
    theme: 'regular',
    calendly_url: '',
  });
  const [cashGoal, setCashGoal] = useState(10000);
  const queryClient = useQueryClient();

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

  const { data: dialerSettings } = useQuery({
    queryKey: ['dialerSettings', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const { data, error } = await supabase
        .from('dialer_settings')
        .select()
        .eq('user_email', currentUser.email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setSettings(data);
        return data;
      }
      return null;
    },
    enabled: !!currentUser?.email,
  });

  useEffect(() => {
    if (userStats?.cash_collected_goal) {
      setCashGoal(userStats.cash_collected_goal);
    }
  }, [userStats]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings) => {
      const { data, error } = await supabase
        .from('dialer_settings')
        .upsert({
          user_email: currentUser.email,
          ...newSettings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_email'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dialerSettings']);
    },
  });

  const saveCashGoalMutation = useMutation({
    mutationFn: async (goal) => {
      const { error } = await supabase
        .from('user_stats')
        .update({ cash_collected_goal: goal })
        .eq('user_email', currentUser.email);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userStats']);
    },
  });

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettingsMutation.mutate(newSettings);
  };

  const handleCashGoalSave = () => {
    saveCashGoalMutation.mutate(cashGoal);
  };

  const handleLogout = () => {
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

          {/* Dialer Settings */}
          <motion.div
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Phone className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Dialer Settings</h2>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Double Dial</Label>
                  <p className="text-purple-300 text-sm mt-1">Call two numbers simultaneously</p>
                </div>
                <Switch
                  checked={settings.double_dial_enabled}
                  onCheckedChange={(checked) => handleSettingChange('double_dial_enabled', checked)}
                />
              </div>

              <div>
                <Label className="text-white font-medium mb-2 block">Max Dialing Lines</Label>
                <select
                  value={settings.max_dialing_lines}
                  onChange={(e) => handleSettingChange('max_dialing_lines', parseInt(e.target.value))}
                  className="w-full p-2 bg-[#1a0f2e] border border-purple-500/20 rounded-xl text-white"
                >
                  <option value="1">1 Line</option>
                  <option value="2">2 Lines</option>
                  <option value="3">3 Lines</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Auto-Detect Voicemail</Label>
                  <p className="text-purple-300 text-sm mt-1">Automatically detect and skip voicemails</p>
                </div>
                <Switch
                  checked={settings.auto_detect_voicemail}
                  onCheckedChange={(checked) => handleSettingChange('auto_detect_voicemail', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Timezone Protection</Label>
                  <p className="text-purple-300 text-sm mt-1">Respect calling hours based on timezone</p>
                </div>
                <Switch
                  checked={settings.timezone_protection}
                  onCheckedChange={(checked) => handleSettingChange('timezone_protection', checked)}
                />
              </div>

              {settings.timezone_protection && (
                <div className="space-y-4 pl-4 border-l-2 border-purple-500/30">
                  <div>
                    <Label className="text-purple-300 text-sm mb-2 block">Timezone</Label>
                    <select
                      value={settings.timezone}
                      onChange={(e) => handleSettingChange('timezone', e.target.value)}
                      className="w-full p-2 bg-[#1a0f2e] border border-purple-500/20 rounded-xl text-white"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-purple-300 text-sm mb-2 block">Start Time</Label>
                      <Input
                        type="time"
                        value={settings.calling_hours_start}
                        onChange={(e) => handleSettingChange('calling_hours_start', e.target.value)}
                        className="bg-[#1a0f2e] border-purple-500/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-purple-300 text-sm mb-2 block">End Time</Label>
                      <Input
                        type="time"
                        value={settings.calling_hours_end}
                        onChange={(e) => handleSettingChange('calling_hours_end', e.target.value)}
                        className="bg-[#1a0f2e] border-purple-500/20 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Theme Settings */}
          <motion.div
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Theme</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {['regular', 'dark', 'christmas'].map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleSettingChange('theme', theme)}
                  className={`p-4 rounded-2xl border-2 transition-all capitalize ${
                    settings.theme === theme
                      ? 'border-indigo-500 bg-indigo-50/10'
                      : 'border-purple-500/20 hover:border-purple-500/40'
                  }`}
                >
                  <p className="text-white font-medium">{theme}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Calendly Integration */}
          <motion.div
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Calendly Integration</h2>
            </div>
            <div>
              <Label className="text-purple-300 text-sm mb-2 block">Calendly Booking URL</Label>
              <Input
                value={settings.calendly_url}
                onChange={(e) => handleSettingChange('calendly_url', e.target.value)}
                placeholder="https://calendly.com/your-link"
                className="bg-[#1a0f2e] border-purple-500/20 text-white"
              />
              <p className="text-purple-400 text-xs mt-2">
                Enter your Calendly link to enable quick appointment booking
              </p>
            </div>
          </motion.div>

          {/* Goals Section */}
          <motion.div
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Cash Goals</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-purple-300 text-sm mb-2 block">Cash Collected Goal</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={cashGoal}
                    onChange={(e) => setCashGoal(parseFloat(e.target.value))}
                    className="bg-[#1a0f2e] border-purple-500/20 text-white"
                  />
                  <Button
                    onClick={handleCashGoalSave}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <p className="text-emerald-400 text-sm">Current: ${userStats?.cash_collected?.toLocaleString() || '0'}</p>
                <p className="text-emerald-300 font-semibold text-lg mt-1">
                  ${userStats?.cash_collected_goal?.toLocaleString() || '10,000'} Goal
                </p>
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