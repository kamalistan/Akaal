import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';
import { TripleLineDialer } from '@/components/dialer/TripleLineDialer';
import { CallDispositionModal } from '@/components/dialer/CallDispositionModal';
import { SessionProgress } from '@/components/dialer/SessionProgress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, PlayCircle, PauseCircle, Filter, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TripleLineDialing() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState('all');
  const [currentBatch, setCurrentBatch] = useState([]);
  const [showDisposition, setShowDisposition] = useState(false);
  const [connectedCall, setConnectedCall] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    attempted: 0,
    connected: 0,
    voicemails: 0,
  });

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

      if (error && error.code !== 'PGRST116') throw error;
      return stats || null;
    },
    enabled: !!currentUser?.email,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const { data, error } = await supabase
        .from('ghl_pipelines')
        .select('*')
        .eq('user_email', currentUser.email)
        .order('name');

      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
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
      return data || { max_dialing_lines: 3 };
    },
    enabled: !!currentUser?.email,
  });

  const maxLines = dialerSettings?.max_dialing_lines || 3;

  const handleStartSession = async () => {
    if (!currentUser?.email) return;

    try {
      const response = await callEdgeFunction('dialerSessionManager/active', {}, {
        method: 'GET',
        params: {
          userEmail: currentUser.email,
          pipelineId: selectedPipeline !== 'all' ? selectedPipeline : null,
        }
      });

      if (response.success) {
        setSessionId(response.session.id);
        setIsSessionActive(true);
        toast.success('Session started!');
        loadNextBatch(response.session.id);
      } else {
        toast.error(response.error || 'Failed to start session');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Failed to start session');
    }
  };

  const loadNextBatch = async (sessId) => {
    if (!currentUser?.email) return;

    const leadsToFetch = maxLines;
    const leads = [];

    for (let i = 0; i < leadsToFetch; i++) {
      try {
        const response = await callEdgeFunction('dialerSessionManager/next-lead', {
          sessionId: sessId || sessionId,
          userEmail: currentUser.email,
        });

        if (response.success && response.lead) {
          leads.push({
            id: response.lead.lead_id,
            name: response.lead.name,
            phone: response.lead.phone,
            email: response.lead.email,
            company: response.lead.company,
          });
        }
      } catch (error) {
        console.error('Error fetching lead:', error);
      }
    }

    if (leads.length > 0) {
      setCurrentBatch(leads);
      startDialing(leads);
    } else {
      toast.info('No more leads in this session');
      handleEndSession();
    }
  };

  const startDialing = async (leads) => {
    if (!currentUser?.email || !sessionId) return;

    try {
      const response = await callEdgeFunction('tripleLineDialer', {
        userEmail: currentUser.email,
        sessionId,
        leads,
        enableAMD: dialerSettings?.auto_detect_voicemail !== false,
        amdSensitivity: dialerSettings?.amd_sensitivity || 'medium',
      });

      if (!response.success) {
        toast.error(response.error || 'Failed to initiate calls');
      }
    } catch (error) {
      console.error('Error initiating calls:', error);
      toast.error('Failed to start dialing');
    }
  };

  const handleCallConnected = (call) => {
    setConnectedCall(call);
    setSessionStats(prev => ({
      ...prev,
      connected: prev.connected + 1,
    }));
    toast.success(`Connected to ${call.lead_name || 'contact'}!`);
  };

  const handleBatchComplete = async () => {
    const attemptedCount = currentBatch.length;
    setSessionStats(prev => ({
      ...prev,
      attempted: prev.attempted + attemptedCount,
    }));

    if (connectedCall) {
      setShowDisposition(true);
    } else {
      markBatchAttempted();
      loadNextBatch(sessionId);
    }
  };

  const markBatchAttempted = async () => {
    for (const lead of currentBatch) {
      try {
        await callEdgeFunction('dialerSessionManager/mark-attempted', {
          sessionId,
          leadId: lead.id,
          userEmail: currentUser?.email,
        });
      } catch (error) {
        console.error('Error marking lead as attempted:', error);
      }
    }
  };

  const handleDispositionSaved = async () => {
    setShowDisposition(false);
    markBatchAttempted();
    setConnectedCall(null);
    loadNextBatch(sessionId);
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      await callEdgeFunction('dialerSessionManager/end-session', {
        sessionId,
      });

      setIsSessionActive(false);
      setSessionId(null);
      setCurrentBatch([]);
      toast.success('Session ended');
    } catch (error) {
      console.error('Error ending session:', error);
    }
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
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Phone className="h-8 w-8 text-cyan-400" />
                Triple-Line Power Dialer
              </h1>
              <p className="text-purple-300 mt-1">
                Call 3 leads at once, connect only to humans
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {maxLines} Lines Active
            </Badge>
          </div>
        </motion.div>

        {!isSessionActive ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="bg-[#2d1f4a]/50 backdrop-blur-sm border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Start New Session</CardTitle>
                <CardDescription className="text-purple-300">
                  Select a pipeline and start power dialing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pipelines.length === 0 ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-200 font-medium">No pipelines found</p>
                        <p className="text-yellow-300/80 text-sm mt-1">
                          Connect your GoHighLevel account in Settings to sync your pipelines and contacts.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-purple-200">
                        Select Pipeline
                      </label>
                      <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                        <SelectTrigger className="bg-[#1a0f2e] border-purple-500/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Pipelines</SelectItem>
                          {pipelines.map((pipeline) => (
                            <SelectItem key={pipeline.id} value={pipeline.id}>
                              {pipeline.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleStartSession}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                      size="lg"
                    >
                      <PlayCircle className="h-5 w-5 mr-2" />
                      Start Dialing
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#2d1f4a]/50 backdrop-blur-sm border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-purple-200">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-sm font-bold">1</span>
                  </div>
                  <p>System calls {maxLines} leads simultaneously</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-sm font-bold">2</span>
                  </div>
                  <p>AMD detects when a human answers (skips voicemails)</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-sm font-bold">3</span>
                  </div>
                  <p>You're instantly connected to the human-answered call</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-sm font-bold">4</span>
                  </div>
                  <p>Other lines automatically hang up</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-sm font-bold">5</span>
                  </div>
                  <p>Process repeats with next batch of {maxLines} leads</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {sessionId && (
              <SessionProgress
                sessionId={sessionId}
                userEmail={currentUser?.email}
              />
            )}

            <TripleLineDialer
              userEmail={currentUser?.email}
              sessionId={sessionId}
              onCallConnected={handleCallConnected}
              onBatchComplete={handleBatchComplete}
            />

            <Card className="bg-[#2d1f4a]/50 backdrop-blur-sm border-purple-500/20">
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {sessionStats.attempted}
                    </div>
                    <div className="text-sm text-purple-300">Attempted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {sessionStats.connected}
                    </div>
                    <div className="text-sm text-purple-300">Connected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">
                      {sessionStats.voicemails}
                    </div>
                    <div className="text-sm text-purple-300">Voicemails</div>
                  </div>
                </div>
                <Button
                  onClick={handleEndSession}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showDisposition && connectedCall && (
          <CallDispositionModal
            open={showDisposition}
            onOpenChange={setShowDisposition}
            callData={connectedCall}
            onDispositionSaved={handleDispositionSaved}
            sessionId={sessionId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
