import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, PhoneOff, Calendar, PhoneMissed, VoicemailIcon, Ban, ChevronRight, Pause, Play, Sparkles, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from '@/api/base44Client';

const outcomeOptions = [
  { value: 'appointment_set', label: 'Appointment Set', icon: Calendar, points: 100, color: 'bg-emerald-500' },
  { value: 'callback', label: 'Callback Scheduled', icon: Phone, points: 25, color: 'bg-blue-500' },
  { value: 'not_interested', label: 'Not Interested', icon: Ban, points: 10, color: 'bg-orange-500' },
  { value: 'no_answer', label: 'No Answer', icon: PhoneMissed, points: 5, color: 'bg-slate-500' },
  { value: 'voicemail', label: 'Left Voicemail', icon: VoicemailIcon, points: 8, color: 'bg-purple-500' },
  { value: 'wrong_number', label: 'Wrong Number', icon: X, points: 2, color: 'bg-red-500' },
];

export default function DialerModal({ lead, onClose, onComplete, userStats }) {
  const [callState, setCallState] = useState('ready'); // ready, calling, ended
  const [duration, setDuration] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [notes, setNotes] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [callSummary, setCallSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCall = () => {
    setCallState('calling');
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setDuration(d => d + 1);
      }
    }, 1000);
  };

  const endCall = () => {
    setCallState('ended');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateSummary = async (callLogId) => {
    setIsGeneratingSummary(true);
    setShowSummary(true);
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate fake summary based on outcome
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
    setIsGeneratingSummary(false);
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) return;
    
    const outcome = outcomeOptions.find(o => o.value === selectedOutcome);
    
    // Create call log
    const callLog = await base44.entities.CallLog.create({
      lead_id: lead.id,
      lead_name: lead.name,
      duration,
      outcome: selectedOutcome,
      points_earned: outcome.points,
      notes,
      is_voicemail: selectedOutcome === 'voicemail'
    });

    // Generate AI summary
    if (callLog?.id) {
      generateSummary(callLog.id);
    }

    // Update lead
    await base44.entities.Lead.update(lead.id, {
      status: selectedOutcome === 'appointment_set' ? 'appointment_set' : 
              selectedOutcome === 'not_interested' ? 'not_interested' :
              selectedOutcome === 'no_answer' ? 'no_answer' : 'contacted',
      last_called: new Date().toISOString(),
      call_count: (lead.call_count || 0) + 1,
      notes: notes ? `${lead.notes || ''}\n[${new Date().toLocaleDateString()}]: ${notes}` : lead.notes
    });

    // Update user stats
    if (userStats) {
      const newStreak = selectedOutcome === 'appointment_set' ? 
        (userStats.current_streak || 0) + 1 : 0;
      
      await base44.entities.UserStats.update(userStats.id, {
        total_points: (userStats.total_points || 0) + outcome.points,
        calls_today: (userStats.calls_today || 0) + 1,
        appointments_today: selectedOutcome === 'appointment_set' ? 
          (userStats.appointments_today || 0) + 1 : userStats.appointments_today,
        current_streak: newStreak,
        best_streak: Math.max(newStreak, userStats.best_streak || 0),
        mascot_mood: newStreak >= 3 ? 'excited' : 
                    (userStats.calls_today || 0) + 1 >= 10 ? 'happy' : 'neutral'
      });
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold">{lead?.name}</h2>
            <p className="text-white/80 mt-1">{lead?.company}</p>
            <p className="text-xl font-mono mt-3">{lead?.phone}</p>
          </div>

          {/* Timer */}
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

        {/* Content */}
        <div className="p-6">
          {callState === 'ready' && (
            <motion.div className="text-center">
              <Button 
                onClick={startCall}
                className="w-full h-16 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-xl font-semibold rounded-2xl shadow-lg shadow-green-500/30"
              >
                <Phone className="w-6 h-6 mr-3" />
                Start Call
              </Button>
            </motion.div>
          )}

          {callState === 'calling' && (
            <motion.div 
              className="flex justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button 
                onClick={togglePause}
                variant="outline"
                className="h-14 px-6 rounded-2xl"
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </Button>
              <Button 
                onClick={endCall}
                className="h-14 px-8 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-2xl shadow-lg shadow-red-500/30"
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

              <Button 
                onClick={handleSubmit}
                disabled={!selectedOutcome || isGeneratingSummary}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-2xl text-lg font-semibold shadow-lg shadow-indigo-500/30 disabled:opacity-50"
              >
                Complete & Earn Points
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>

              {/* AI Call Summary */}
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
                          onClick={() => onComplete(outcomeOptions.find(o => o.value === selectedOutcome)?.points || 0)}
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