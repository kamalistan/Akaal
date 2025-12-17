import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import MetricCard from '@/components/metrics/MetricCard';
import CallVolumeChart from '@/components/metrics/CallVolumeChart';
import CallOutcomesChart from '@/components/metrics/CallOutcomesChart';
import QuickInsights from '@/components/metrics/QuickInsights';
import { Phone, Users, TrendingUp, Clock, Activity, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startOfDay, startOfWeek, startOfMonth, format, parseISO, isAfter } from 'date-fns';

export default function Metrics() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRange, setSelectedRange] = useState('week');

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

  const { data: allCallLogs = [] } = useQuery({
    queryKey: ['allCallLogs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select()
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data || [];
    },
  });

  // Filter logs based on selected range
  const getStartDate = () => {
    const now = new Date();
    if (selectedRange === 'today') return startOfDay(now);
    if (selectedRange === 'week') return startOfWeek(now);
    if (selectedRange === 'month') return startOfMonth(now);
    return startOfWeek(now);
  };

  const callLogs = allCallLogs.filter(log => {
    const logDate = parseISO(log.created_at);
    return isAfter(logDate, getStartDate());
  });

  // Calculate metrics
  const totalCalls = callLogs.length;
  const appointments = callLogs.filter(log => log.outcome === 'appointment_set').length;
  const connected = callLogs.filter(log => 
    log.outcome !== 'no_answer' && log.outcome !== 'wrong_number'
  ).length;
  const connectionRate = totalCalls > 0 ? ((connected / totalCalls) * 100).toFixed(1) : '0.0';
  const successRate = totalCalls > 0 ? ((appointments / totalCalls) * 100).toFixed(1) : '0.0';
  
  const totalTalkTime = callLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const avgDuration = totalCalls > 0 ? Math.floor(totalTalkTime / totalCalls) : 0;
  
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Prepare chart data
  const prepareCallVolumeData = () => {
    const dataMap = {};
    
    callLogs.forEach(log => {
      const day = format(parseISO(log.created_at), selectedRange === 'month' ? 'MMM d' : 'EEE');
      if (!dataMap[day]) {
        dataMap[day] = { name: day, totalCalls: 0, appointments: 0 };
      }
      dataMap[day].totalCalls++;
      if (log.outcome === 'appointment_set') {
        dataMap[day].appointments++;
      }
    });

    return Object.values(dataMap);
  };

  const prepareOutcomesData = () => {
    const outcomeMap = {};
    
    callLogs.forEach(log => {
      const outcome = log.outcome || 'unknown';
      outcomeMap[outcome] = (outcomeMap[outcome] || 0) + 1;
    });

    return Object.entries(outcomeMap).map(([outcome, count]) => ({
      outcome,
      count
    }));
  };

  // Calculate insights
  const calculateInsights = () => {
    const dayMap = {};
    const hourMap = {};

    callLogs.forEach(log => {
      const date = parseISO(log.created_at);
      const day = format(date, 'EEEE');
      const hour = date.getHours();

      dayMap[day] = (dayMap[day] || 0) + 1;
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });

    const bestDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];

    const weekGoal = userStats?.daily_goal ? `${successRate}%` : '0%';
    const weekGoalDetail = userStats?.daily_goal ? `${appointments}/${userStats.daily_goal * 7} calls` : '';

    return {
      bestDay: bestDay ? bestDay[0] : 'N/A',
      bestDayDetail: bestDay ? `${bestDay[1]} calls made` : '',
      peakHour: peakHour ? `${peakHour[0]}:00 - ${parseInt(peakHour[0]) + 1}:00` : 'N/A',
      peakHourDetail: peakHour ? 'Highest conversion' : '',
      weekGoal,
      weekGoalDetail
    };
  };

  const callVolumeData = prepareCallVolumeData();
  const outcomesData = prepareOutcomesData();
  const insights = calculateInsights();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] p-6">
      <div className="max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        <div className="mb-6">
          <TabNav />
        </div>

        {/* Header with date selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Performance Metrics</h2>
            <p className="text-purple-300 text-sm">Track your calling performance</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setSelectedRange('today')}
              variant={selectedRange === 'today' ? 'default' : 'outline'}
              className={selectedRange === 'today' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-[#2d1f4a] border-purple-500/30 text-purple-300 hover:bg-purple-900/30'
              }
            >
              Today
            </Button>
            <Button
              onClick={() => setSelectedRange('week')}
              variant={selectedRange === 'week' ? 'default' : 'outline'}
              className={selectedRange === 'week' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-[#2d1f4a] border-purple-500/30 text-purple-300 hover:bg-purple-900/30'
              }
            >
              This Week
            </Button>
            <Button
              onClick={() => setSelectedRange('month')}
              variant={selectedRange === 'month' ? 'default' : 'outline'}
              className={selectedRange === 'month' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-[#2d1f4a] border-purple-500/30 text-purple-300 hover:bg-purple-900/30'
              }
            >
              This Month
            </Button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <MetricCard 
            title="Total Calls" 
            value={totalCalls} 
            icon={Phone} 
            trend="+12%" 
            trendValue={12}
            delay={0}
          />
          <MetricCard 
            title="Connection Rate" 
            value={`${connectionRate}%`} 
            icon={Users} 
            trend="+5%" 
            trendValue={5}
            delay={0.05}
          />
          <MetricCard 
            title="Success Rate" 
            value={`${successRate}%`} 
            icon={TrendingUp} 
            trend="+8%" 
            trendValue={8}
            delay={0.1}
          />
          <MetricCard 
            title="Total Talk Time" 
            value={formatDuration(totalTalkTime)} 
            icon={Clock} 
            trend="+2h" 
            trendValue={120}
            delay={0.15}
          />
          <MetricCard 
            title="Avg Call Duration" 
            value={formatDuration(avgDuration)} 
            icon={Activity} 
            trend="+30s" 
            trendValue={30}
            delay={0.2}
          />
          <MetricCard 
            title="Calls Recorded" 
            value={totalCalls} 
            icon={Mic} 
            trend="+15" 
            trendValue={15}
            delay={0.25}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div 
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-400" />
              <h3 className="text-xl font-bold text-white">Call Volume</h3>
            </div>
            {callVolumeData.length > 0 ? (
              <CallVolumeChart data={callVolumeData} />
            ) : (
              <div className="h-80 flex items-center justify-center text-purple-400">
                No data available for this period
              </div>
            )}
          </motion.div>

          <motion.div 
            className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-purple-400" />
              <h3 className="text-xl font-bold text-white">Call Outcomes</h3>
            </div>
            {outcomesData.length > 0 ? (
              <CallOutcomesChart data={outcomesData} />
            ) : (
              <div className="h-80 flex items-center justify-center text-purple-400">
                No data available for this period
              </div>
            )}
          </motion.div>
        </div>

        {/* Quick Insights */}
        <motion.div 
          className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-xl font-bold text-white mb-6">Quick Insights</h3>
          <QuickInsights insights={insights} />
        </motion.div>
      </div>
    </div>
  );
}