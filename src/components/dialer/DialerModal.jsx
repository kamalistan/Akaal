import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, PhoneOff, Calendar, PhoneMissed, VoicemailIcon, Ban, ChevronRight, ChevronLeft, Sparkles, Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { twilioClientManager } from '@/utils/twilioClient';
import { useActiveCallsSync } from '@/hooks/useActiveCallsSync';
import MultiLineCallQueue from './MultiLineCallQueue';
import AudioDeviceSelector from './AudioDeviceSelector';

const outcomeOptions = [
  { value: 'appointment_set', label: 'Appointment Set', icon: Calendar, points: 100, color: 'bg-emerald-500' },
  { value: 'callback', label: 'Callback Scheduled', icon: Phone, points: 25, color: 'bg-blue-500' },
  { value: 'not_interested', label: 'Not Interested', icon: Ban, points: 10, color: 'bg-orange-500' },
  { value: 'no_answer', label: 'No Answer', icon: PhoneMissed, points: 5, color: 'bg-slate-500' },
  { value: 'voicemail', label: 'Left Voicemail', icon: VoicemailIcon, points: 8, color: 'bg-purple-500' },
  { value: 'wrong_number', label: 'Wrong Number', icon: X, points: 2, color: 'bg-red-500' },
];

export default function DialerModalNew({ lead, onClose, onComplete, onNext, onPrev, hasNext, hasPrev, userStats, sessionId = null, sessionManager = null }) {
  const { theme, currentTheme } = useTheme();
  const [callState, setCallState] = useState('ready');
  const [duration, setDuration] = useState(0);
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
  const timerRef = useRef(null);
  const isCallInProgressRef = useRef(false);
  const userEmail = 'demo@example.com';

  const { activeLines, connectedLine, hasActiveLines } = useActiveCallsSync(userEmail);

  useEffect(() => {
    const cleanupAndInitialize = async () => {
      await supabase
        .from('active_calls')
        .delete()
        .eq('user_email', userEmail)
        .in('status', ['completed', 'failed', 'busy', 'no-answer', 'canceled', 'voicemail_detected', 'dropped_other_answered']);

      const success = await twilioClientManager.initialize(userEmail);
      setTwilioClientReady(true);
      setHasAudioDevices(success);

      if (success) {
        twilioClientManager.onCallAnswered((call) => {
          console.log('Call answered in browser');
          setCallState('connected');
          setCallError('');

          timerRef.current = setInterval(() => {
            setDuration(d => d + 1);
          }, 1000);
        });

        twilioClientManager.onCallEnded(() => {
          console.log('Call ended');
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        });

        twilioClientManager.onCallError((error) => {
          console.error('Call error:', error);
          setCallError(`Call error: ${error.message || 'Unknown error'}`);
          setCallState('ready');
        });
      }
    };

    cleanupAndInitialize();

    const loadDialerSettings = async () => {
      const { data } = await supabase
        .from('dialer_settings')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (data) {
        setDialerSettings(data);
      }
    };

    loadDialerSettings();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (connectedLine && callState !== 'connected') {
      setCallState('connected');
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      }
    } else if (!connectedLine && !hasActiveLines && callState === 'calling') {
      setCallState('ready');
      isCallInProgressRef.current = false;
    }
  }, [connectedLine, callState, hasActiveLines]);

  const startCall = async () => {
    if (isCallInProgressRef.current) {
      console.log('Call already in progress, ignoring duplicate click');
      return;
    }

    isCallInProgressRef.current = true;
    setCallState('calling');
    setCallError('');

    try {
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

      if (response.success) {
        console.log('Call initiated:', response.callSid);
      } else if (response.needsSetup) {
        setCallError('Twilio not configured. Using demo mode.');
        setCallState('connected');

        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      } else {
        setCallError(response.error || 'Failed to initiate call');
        setCallState('ready');
        isCallInProgressRef.current = false;
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setCallError(error.message || 'Failed to initiate call');
      setCallState('ready');
      isCallInProgressRef.current = false;
    }
  };

  const endCall = async () => {
    try {
      await callEdgeFunction('twilioEndCall', {
        callSid: connectedLine?.call_sid,
        userEmail: userEmail,
      });

      twilioClientManager.disconnectCall();
    } catch (error) {
      console.error('Error ending call:', error);
    }

    isCallInProgressRef.current = false;
    setCallState('ended');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleModalClose = async () => {
    await supabase
      .from('active_calls')
      .delete()
      .eq('user_email', userEmail)
      .in('status', ['initiating', 'queued', 'ringing']);

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

      if (callLog?.id) {
        await generateSummary(callLog.id);
      }
    } catch (error) {
      console.error('Error submitting call:', error);
      setSubmitError(error.message || 'Failed to save call. Please try again.');
      setIsSubmitting(false);
    }
  };

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
        <div className="p-6 text-white relative bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex gap-2 z-30">
            {hasPrev && (
              <button
                onClick={onPrev}
                disabled={callState !== 'ready'}
                className="p-2 hover:bg-white/20 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={onNext}
                disabled={callState !== 'ready'}
                className="p-2 hover:bg-white/20 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="absolute top-4 right-4 flex gap-2 z-30">
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
          </div>

          {callState !== 'ready' && (
            <motion.div
              className="text-center mt-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <span className="text-4xl font-mono font-bold">{formatTime(duration)}</span>
            </motion.div>
          )}
        </div>

        <div className="p-6">
          {hasActiveLines && (
            <MultiLineCallQueue activeLines={activeLines} />
          )}

          {callState === 'ready' && (
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

          {(callState === 'calling' || hasActiveLines) && !connectedLine && (
            <motion.div
              className="text-center py-6 space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Dialing...</p>
              <p className="text-slate-400 text-sm">Please wait while we connect</p>
              <Button
                onClick={async () => {
                  await supabase
                    .from('active_calls')
                    .delete()
                    .eq('user_email', userEmail)
                    .eq('lead_id', lead.id);

                  setCallState('ready');
                  isCallInProgressRef.current = false;
                }}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Cancel Call
              </Button>
            </motion.div>
          )}

          {callState === 'connected' && (
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

          {callState === 'ended' && (
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
                          ? 'border-indigo-500 bg-indigo-50'
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
                className="w-full h-14 bg-gradient-to-r rounded-2xl text-lg font-semibold shadow-lg disabled:opacity-50 from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30"
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
                    className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-sm font-semibold text-indigo-900">AI Call Summary</h4>
                    </div>
                    {isGeneratingSummary ? (
                      <div className="flex items-center gap-2 text-indigo-600 text-sm">
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
                          className="w-full bg-indigo-600 hover:bg-indigo-700"
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
