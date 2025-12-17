import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, PhoneOff, Calendar, PhoneMissed, VoicemailIcon, Ban, ChevronRight, ChevronLeft, Sparkles, Loader2, Mic, MicOff, Wifi, WifiOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { twilioClientManager } from '@/utils/twilioClient';
import { useCallSubscription } from '@/hooks/useCallSubscription';
import AudioDeviceSelector from './AudioDeviceSelector';

const outcomeOptions = [
  { value: 'appointment_set', label: 'Appointment Set', icon: Calendar, points: 100, color: 'bg-emerald-500' },
  { value: 'callback', label: 'Callback Scheduled', icon: Phone, points: 25, color: 'bg-blue-500' },
  { value: 'not_interested', label: 'Not Interested', icon: Ban, points: 10, color: 'bg-orange-500' },
  { value: 'no_answer', label: 'No Answer', icon: PhoneMissed, points: 5, color: 'bg-slate-500' },
  { value: 'voicemail', label: 'Left Voicemail', icon: VoicemailIcon, points: 8, color: 'bg-purple-500' },
  { value: 'wrong_number', label: 'Wrong Number', icon: X, points: 2, color: 'bg-red-500' },
];

export default function DialerModal({ lead, onClose, onComplete, onNext, onPrev, hasNext, hasPrev, userStats, sessionId = null, sessionManager = null }) {
  const { theme, currentTheme } = useTheme();
  const userEmail = 'demo@example.com';

  const { currentCall, isConnected, clearCall, updateCallStatus } = useCallSubscription(userEmail, lead?.id);

  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [notes, setNotes] = useState('');
  const [callSummary, setCallSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [callError, setCallError] = useState('');
  const [twilioClientReady, setTwilioClientReady] = useState(false);
  const [hasAudioDevices, setHasAudioDevices] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dialerSettings, setDialerSettings] = useState(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  const callStatus = currentCall?.status || 'idle';
  const isCallActive = currentCall?.isActive || false;
  const isCallConnected = callStatus === 'in-progress' || callStatus === 'connected';

  useEffect(() => {
    const loadDialerSettings = async () => {
      const { data } = await supabase
        .from('dialer_settings')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (data) {
        setDialerSettings(data);
      } else {
        setDialerSettings({ use_mock_dialer: false });
      }
    };

    loadDialerSettings();

    const initializeTwilio = async () => {
      const success = await twilioClientManager.initialize(userEmail);
      setTwilioClientReady(true);
      setHasAudioDevices(success);

      if (success) {
        twilioClientManager.onCallAnswered(() => {
          console.log('Twilio call answered in browser');
        });

        twilioClientManager.onCallEnded(() => {
          console.log('Twilio call ended');
        });

        twilioClientManager.onCallError((error) => {
          console.error('Twilio call error:', error);
          setCallError(`Call error: ${error.message || 'Unknown error'}`);
        });
      }
    };

    initializeTwilio();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isCallConnected) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callStatus === 'idle' || !currentCall) {
        setDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCallConnected, callStatus, currentCall]);

  useEffect(() => {
    if (currentCall?.last_error) {
      setCallError(currentCall.last_error);
    }
  }, [currentCall]);

  const startCall = async () => {
    if (isCallActive) {
      console.log('Call already in progress');
      return;
    }

    setCallError('');
    setDuration(0);

    try {
      const useMockMode = dialerSettings?.use_mock_dialer || false;

      if (useMockMode) {
        console.log('Using mock dialer mode');
        const response = await callEdgeFunction('mockDialerCall', {
          to: lead.phone,
          leadId: lead.id,
          leadName: lead.name,
          userEmail: userEmail,
          lineNumber: 1,
          sessionId: sessionId,
          mockConfig: dialerSettings?.mock_config || {},
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to initiate mock call');
        }
      } else {
        console.log('Using real Twilio dialer');
        const response = await callEdgeFunction('twilioInitiateCall', {
          to: lead.phone,
          leadId: lead.id,
          leadName: lead.name,
          userEmail: userEmail,
          lineNumber: 1,
          enableAMD: dialerSettings?.auto_detect_voicemail || false,
          amdSensitivity: dialerSettings?.amd_sensitivity || 'medium',
          enableRecording: dialerSettings?.enable_call_recording || false,
          sessionId: sessionId,
        });

        if (response.needsSetup) {
          setCallError('Twilio not configured. Enable Demo Mode in Settings to test without Twilio.');
        } else if (!response.success) {
          throw new Error(response.error || 'Failed to initiate call');
        }
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setCallError(error.message || 'Failed to initiate call');
    }
  };

  const endCall = async () => {
    try {
      if (!currentCall?.is_mock) {
        await callEdgeFunction('twilioEndCall', {
          callSid: currentCall?.call_sid,
          userEmail: userEmail,
        });
        twilioClientManager.disconnectCall();
      }

      await updateCallStatus('ended', { ended_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error ending call:', error);
      await updateCallStatus('ended', { ended_at: new Date().toISOString() });
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelCall = async () => {
    try {
      if (currentCall?.call_sid && !currentCall?.is_mock) {
        await callEdgeFunction('twilioEndCall', {
          callSid: currentCall.call_sid,
          userEmail: userEmail,
          leadId: lead.id
        });
      }

      await clearCall();
      setCallError('');
    } catch (error) {
      console.error('Error cancelling call:', error);
      await clearCall();
    }
  };

  const handleModalClose = async () => {
    if (isCallActive) {
      await cancelCall();
    }
    onClose();
  };

  const toggleMute = () => {
    if (isMuted) {
      twilioClientManager.unmuteCall();
      setIsMuted(false);
    } else {
      twilioClientManager.muteCall();
      setIsMuted(true);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateSummary = async (callLogId) => {
    setIsGeneratingSummary(true);
    setShowSummary(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const summaries = {
        'appointment_set': `Successfully scheduled an appointment with ${lead.name}. Prospect showed strong interest in our solution and agreed to a follow-up meeting. Next steps: Send calendar invite and preparation materials.`,
        'callback': `${lead.name} requested a callback at a later time. They seem interested but need more time to consider. Follow up within 24-48 hours to maintain momentum.`,
        'not_interested': `Spoke with ${lead.name} who indicated they're not currently interested in our services. They mentioned budget constraints and timing issues. Consider following up in 3-6 months.`,
        'no_answer': `No answer on this call attempt. Phone rang but ${lead.name} did not pick up. Recommend trying again at a different time of day, potentially early morning or late afternoon.`,
        'voicemail': `Left a professional voicemail for ${lead.name} introducing our services. Mentioned key value propositions and requested a callback. Track for response within 48 hours.`,
        'wrong_number': `Incorrect contact information on file for ${lead.name}. The number reached does not belong to the prospect. Data needs to be updated with correct contact details.`
      };

      const summary = summaries[selectedOutcome] || `Call completed with ${lead.name}. Duration: ${Math.floor(duration / 60)}m ${duration % 60}s.`;
      setCallSummary(summary);
    } finally {
      setIsGeneratingSummary(false);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) {
      setSubmitError('Please select a call outcome first');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const outcome = outcomeOptions.find(o => o.value === selectedOutcome);

      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .insert({
          lead_id: lead.id,
          lead_name: lead.name,
          duration,
          outcome: selectedOutcome,
          points_earned: outcome.points,
          notes,
          user_email: userEmail,
          session_id: sessionId,
          has_recording: dialerSettings?.enable_call_recording || false,
        })
        .select()
        .single();

      if (callLogError) throw callLogError;

      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({
          status: selectedOutcome === 'appointment_set' ? 'appointment_set' :
                  selectedOutcome === 'not_interested' ? 'not_interested' :
                  selectedOutcome === 'no_answer' ? 'no_answer' : 'contacted',
          last_called: new Date().toISOString(),
          last_called_at: new Date().toISOString(),
          last_called_by: userEmail,
          call_count: (lead.call_count || 0) + 1,
          notes: notes ? `${lead.notes || ''}\n[${new Date().toLocaleDateString()}]: ${notes}` : lead.notes
        })
        .eq('id', lead.id);

      if (leadUpdateError) throw leadUpdateError;

      if (userStats) {
        const newStreak = selectedOutcome === 'appointment_set' ?
          (userStats.current_streak || 0) + 1 : 0;

        const { error: statsUpdateError } = await supabase
          .from('user_stats')
          .update({
            total_points: (userStats.total_points || 0) + outcome.points,
            calls_today: (userStats.calls_today || 0) + 1,
            appointments_today: selectedOutcome === 'appointment_set' ?
              (userStats.appointments_today || 0) + 1 : userStats.appointments_today,
            current_streak: newStreak,
            best_streak: Math.max(newStreak, userStats.best_streak || 0),
            mascot_mood: newStreak >= 3 ? 'excited' :
                        (userStats.calls_today || 0) + 1 >= 10 ? 'happy' : 'neutral'
          })
          .eq('id', userStats.id);

        if (statsUpdateError) throw statsUpdateError;
      }

      await clearCall();

      if (callLog?.id) {
        await generateSummary(callLog.id);
      }
    } catch (error) {
      console.error('Error submitting call:', error);
      setSubmitError(error.message || 'Failed to save call. Please try again.');
      setIsSubmitting(false);
    }
  };

  const showReadyState = callStatus === 'idle' || !currentCall;
  const showDialingState = callStatus === 'dialing' || callStatus === 'initiating' || callStatus === 'queued' || callStatus === 'ringing';
  const showConnectedState = isCallConnected;
  const showEndedState = callStatus === 'ended' || (currentCall?.isTerminal && callStatus !== 'idle');

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden bg-white relative"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="p-6 text-white relative bg-gradient-to-r from-blue-600 to-cyan-600">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex gap-2 z-30">
            {hasPrev && (
              <button
                onClick={onPrev}
                disabled={isCallActive}
                className="p-2 hover:bg-white/20 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={onNext}
                disabled={isCallActive}
                className="p-2 hover:bg-white/20 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="absolute top-4 right-4 flex gap-2 z-30">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-white/60" title="Real-time connected" />
            ) : (
              <WifiOff className="w-4 h-4 text-white/40" title="Real-time disconnected" />
            )}
            {hasAudioDevices && <AudioDeviceSelector />}
            <button
              onClick={handleModalClose}
              className="p-2 hover:bg-white/20 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold">{lead?.name}</h2>
            <p className="text-white/80 mt-1">{lead?.company}</p>
            <p className="text-xl font-mono mt-3">{lead?.phone}</p>
            {currentCall?.is_mock && (
              <div className="mt-2 inline-block px-3 py-1 bg-white/20 rounded-full text-xs">
                Demo Mode
              </div>
            )}
          </div>

          {showConnectedState && (
            <motion.div
              className="text-center mt-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <span className="text-4xl font-mono font-bold">{formatTime(duration)}</span>
            </motion.div>
          )}

          {showDialingState && (
            <motion.div
              className="text-center mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">{currentCall?.statusInfo?.label || 'Calling...'}</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-6">
          {showReadyState && (
            <motion.div className="text-center space-y-4">
              {callError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
                >
                  {callError}
                </motion.div>
              )}
              <Button
                onClick={startCall}
                className="w-full h-16 text-xl font-semibold rounded-2xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/30"
              >
                <Phone className="w-6 h-6 mr-3" />
                Start Call
              </Button>
            </motion.div>
          )}

          {showDialingState && (
            <motion.div
              className="text-center py-6 space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-slate-600 font-medium">Connecting to {lead.name}...</p>
              <p className="text-slate-400 text-sm">Please wait while we establish the connection</p>
              <Button
                onClick={cancelCall}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Cancel Call
              </Button>
            </motion.div>
          )}

          {showConnectedState && (
            <motion.div
              className="flex justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                onClick={toggleMute}
                variant="outline"
                className="h-14 px-6 rounded-2xl"
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button
                onClick={endCall}
                className="h-14 px-8 bg-gradient-to-r rounded-2xl shadow-lg from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/30"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>
            </motion.div>
          )}

          {showEndedState && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="font-semibold text-slate-700 mb-3">Call Outcome</h3>
              <div className="grid grid-cols-2 gap-3">
                {outcomeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedOutcome === option.value;
                  return (
                    <motion.button
                      key={option.value}
                      onClick={() => setSelectedOutcome(option.value)}
                      className={`
                        p-4 rounded-2xl border-2 transition-all text-left
                        ${isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                        }
                      `}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${option.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 text-sm">{option.label}</p>
                          <p className="text-xs text-emerald-600 font-semibold">+{option.points} pts</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <Textarea
                placeholder="Add notes about the call..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-2xl border-slate-200 resize-none h-24"
              />

              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
                >
                  {submitError}
                </motion.div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!selectedOutcome || isSubmitting || isGeneratingSummary}
                className="w-full h-14 bg-gradient-to-r rounded-2xl text-lg font-semibold shadow-lg disabled:opacity-50 from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-500/30"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete & Earn Points
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <AnimatePresence>
                {showSummary && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-blue-900">AI Call Summary</h4>
                    </div>
                    {isGeneratingSummary ? (
                      <div className="flex items-center gap-2 text-blue-600 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing call...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-700 text-sm leading-relaxed mb-3">{callSummary}</p>
                        <Button
                          onClick={async () => {
                            const points = outcomeOptions.find(o => o.value === selectedOutcome)?.points || 0;
                            onComplete(points, sessionId);
                            await handleModalClose();
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          Done
                        </Button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
