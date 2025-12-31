import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PhoneCall, CheckCircle2, Clock, Target, Play, Pause, RotateCcw } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabase';

export function SessionProgress({
  sessionId,
  userEmail,
  onSessionEnd,
  className = ''
}) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const fetchProgress = async () => {
      try {
        const response = await callEdgeFunction('dialerSessionManager/progress', {}, {
          method: 'GET',
          params: { sessionId }
        });

        if (response.success && response.progress) {
          setProgress(response.progress);
        }
      } catch (error) {
        console.error('Error fetching session progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading || !progress) {
    return null;
  }

  const percentComplete = progress.total_leads > 0
    ? Math.round((progress.attempted_count / progress.total_leads) * 100)
    : 0;

  const successRate = progress.attempted_count > 0
    ? Math.round((progress.successful_attempts / progress.attempted_count) * 100)
    : 0;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Dialing Session</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {progress.is_active ? 'Active' : 'Paused'}
                </p>
              </div>
            </div>
            {progress.is_active && (
              <Badge variant="default" className="bg-green-500">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <span>Live</span>
                </div>
              </Badge>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Progress
              </span>
              <span className="font-medium">
                {progress.attempted_count} / {progress.total_leads} leads
              </span>
            </div>
            <Progress value={percentComplete} className="h-2" />
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {percentComplete}% complete
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <PhoneCall className="h-3.5 w-3.5" />
                {progress.attempted_count}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Attempted
              </div>
            </div>

            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="flex items-center justify-center gap-1 text-sm font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {progress.successful_attempts}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Connected
              </div>
            </div>

            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center justify-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-400">
                <Target className="h-3.5 w-3.5" />
                {successRate}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Success Rate
              </div>
            </div>
          </div>

          {/* Time Info */}
          {progress.seconds_since_activity < 300 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Last activity {Math.floor(progress.seconds_since_activity / 60)}m ago
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
