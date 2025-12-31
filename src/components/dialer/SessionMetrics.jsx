import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneCall, PhoneIncoming, Clock, TrendingUp, Target, Award } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabase';

function MetricCard({ icon: Icon, label, value, subtitle, trend, iconColor = 'text-blue-600' }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold">{value}</p>
              {trend !== undefined && (
                <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trend >= 0 ? '+' : ''}{trend}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800 ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function SessionMetrics({ userEmail, sessionId, className = '' }) {
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [sessionMetrics, setSessionMetrics] = useState(null);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Fetch today's metrics
        const todayResponse = await callEdgeFunction('dialerMetrics/today', {}, {
          method: 'GET',
          params: { userEmail: userEmail || 'demo@example.com' }
        });

        if (todayResponse.success) {
          setTodayMetrics(todayResponse.metrics);
        }

        // Fetch session metrics if session is active
        if (sessionId) {
          const sessionResponse = await callEdgeFunction('dialerMetrics', {}, {
            method: 'GET',
            params: { sessionId }
          });

          if (sessionResponse.success) {
            setSessionMetrics(sessionResponse.metrics);
          }
        }

        // Fetch 30-day summary
        const summaryResponse = await callEdgeFunction('dialerMetrics/summary', {}, {
          method: 'GET',
          params: { userEmail: userEmail || 'demo@example.com', days: 30 }
        });

        if (summaryResponse.success) {
          setSummaryMetrics(summaryResponse.metrics);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [userEmail, sessionId]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="session" disabled={!sessionId}>Session</TabsTrigger>
          <TabsTrigger value="summary">30 Days</TabsTrigger>
        </TabsList>

        {/* Today's Metrics */}
        <TabsContent value="today" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={PhoneCall}
              label="Calls Made"
              value={todayMetrics?.totalCalls || 0}
              iconColor="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              icon={PhoneIncoming}
              label="Pickups"
              value={todayMetrics?.pickups || 0}
              subtitle={`${todayMetrics?.contactRate || 0}% contact rate`}
              iconColor="text-green-600 dark:text-green-400"
            />
            <MetricCard
              icon={Clock}
              label="Talk Time"
              value={formatDuration(todayMetrics?.totalTalkTime || 0)}
              subtitle={`Avg: ${formatDuration(todayMetrics?.avgTalkTime || 0)}`}
              iconColor="text-purple-600 dark:text-purple-400"
            />
            <MetricCard
              icon={Target}
              label="Success Rate"
              value={`${todayMetrics?.successRate || 0}%`}
              subtitle={`${todayMetrics?.connected || 0} connected`}
              iconColor="text-orange-600 dark:text-orange-400"
            />
          </div>

          {/* Outcomes Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Call Outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Connected</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${todayMetrics?.totalCalls > 0
                            ? (todayMetrics.connected / todayMetrics.totalCalls) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {todayMetrics?.connected || 0}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Voicemail</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${todayMetrics?.totalCalls > 0
                            ? (todayMetrics.voicemails / todayMetrics.totalCalls) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {todayMetrics?.voicemails || 0}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">No Answer</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500"
                        style={{
                          width: `${todayMetrics?.totalCalls > 0
                            ? (todayMetrics.noAnswers / todayMetrics.totalCalls) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {todayMetrics?.noAnswers || 0}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session Metrics */}
        <TabsContent value="session" className="space-y-4 mt-4">
          {sessionMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={PhoneCall}
                label="Session Calls"
                value={sessionMetrics.totalCalls}
                iconColor="text-blue-600 dark:text-blue-400"
              />
              <MetricCard
                icon={TrendingUp}
                label="Connected"
                value={sessionMetrics.connected}
                subtitle={`${sessionMetrics.successRate}% success`}
                iconColor="text-green-600 dark:text-green-400"
              />
              <MetricCard
                icon={Clock}
                label="Avg Duration"
                value={formatDuration(sessionMetrics.avgCallDuration)}
                iconColor="text-purple-600 dark:text-purple-400"
              />
              <MetricCard
                icon={PhoneIncoming}
                label="Contact Rate"
                value={`${sessionMetrics.contactRate}%`}
                subtitle={`${sessionMetrics.pickups} pickups`}
                iconColor="text-orange-600 dark:text-orange-400"
              />
            </div>
          )}
        </TabsContent>

        {/* 30-Day Summary */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          {summaryMetrics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={PhoneCall}
                  label="Total Calls"
                  value={summaryMetrics.totalCalls}
                  subtitle={`${summaryMetrics.avgCallsPerDay}/day avg`}
                  iconColor="text-blue-600 dark:text-blue-400"
                />
                <MetricCard
                  icon={Award}
                  label="Connected"
                  value={summaryMetrics.connected}
                  subtitle={`${summaryMetrics.successRate}% success`}
                  iconColor="text-green-600 dark:text-green-400"
                />
                <MetricCard
                  icon={Clock}
                  label="Total Talk Time"
                  value={formatDuration(summaryMetrics.totalTalkTime)}
                  subtitle={`Avg: ${formatDuration(summaryMetrics.avgTalkTime)}`}
                  iconColor="text-purple-600 dark:text-purple-400"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Longest Call"
                  value={formatDuration(summaryMetrics.longestCall)}
                  iconColor="text-orange-600 dark:text-orange-400"
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
