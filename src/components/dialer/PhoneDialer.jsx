import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Delete, User, Clock, Star,
  Mic, MicOff, Volume2, VolumeX, X, Search, Plus, Settings as SettingsIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { twilioClientManager } from '@/utils/twilioClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatPhoneNumber,
  validatePhoneNumber,
  normalizePhoneNumber,
  getCallDurationFormatted,
  getContactInitials,
  extractDigits
} from '@/utils/phoneUtils';
import { toast } from 'sonner';

const DIAL_TONES = {
  '1': 697, '2': 770, '3': 852,
  '4': 697, '5': 770, '6': 852,
  '7': 697, '8': 770, '9': 852,
  '*': 941, '0': 941, '#': 941
};

export default function PhoneDialer({ onClose, initialNumber = '', userEmail = 'demo@example.com' }) {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dialer');
  const [currentCallSid, setCurrentCallSid] = useState(null);

  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ['dialerPreferences', userEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_preferences')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        const { data: newPrefs, error: createError } = await supabase
          .from('dialer_preferences')
          .insert({
            user_email: userEmail,
            default_country_code: '+1',
            number_format_preference: 'us',
            enable_dial_tones: true,
            enable_vibration: true,
            save_to_history: true
          })
          .select()
          .single();

        if (createError) throw createError;
        return newPrefs;
      }

      return data;
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['dialerFavorites', userEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_favorites')
        .select('*')
        .eq('user_email', userEmail)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentNumbers = [] } = useQuery({
    queryKey: ['recentNumbers', userEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recent_numbers')
        .select('*')
        .eq('user_email', userEmail)
        .order('last_called_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: callHistory = [] } = useQuery({
    queryKey: ['dialerCallHistory', userEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_call_history')
        .select('*')
        .eq('user_email', userEmail)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const createCallHistoryMutation = useMutation({
    mutationFn: async (callData) => {
      const { data, error } = await supabase
        .from('dialer_call_history')
        .insert(callData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dialerCallHistory']);
      queryClient.invalidateQueries(['recentNumbers']);
    },
  });

  useEffect(() => {
    if (isCallActive && callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callStatus === 'idle') {
        setCallDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isCallActive, callStatus]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playDialTone = useCallback((digit) => {
    if (!preferences?.enable_dial_tones) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = DIAL_TONES[digit] || 697;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (error) {
      console.error('Error playing dial tone:', error);
    }
  }, [preferences]);

  const handleNumberInput = useCallback((digit) => {
    setPhoneNumber(prev => prev + digit);
    playDialTone(digit);

    if (preferences?.enable_vibration && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [playDialTone, preferences]);

  const handleBackspace = useCallback(() => {
    setPhoneNumber(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPhoneNumber('');
  }, []);

  const initiateCall = async () => {
    const validation = validatePhoneNumber(phoneNumber);

    if (!validation.valid) {
      toast.error(validation.error || 'Invalid phone number');
      if (validation.isEmergency) {
        toast.error('Please dial emergency services directly from your phone');
      }
      return;
    }

    const normalized = normalizePhoneNumber(validation.cleaned, preferences?.default_country_code);

    try {
      setIsCallActive(true);
      setCallStatus('dialing');
      setCallDuration(0);

      const historyEntry = await createCallHistoryMutation.mutateAsync({
        user_email: userEmail,
        phone_number: normalized,
        direction: 'outbound',
        status: 'initiated',
        started_at: new Date().toISOString(),
      });

      const response = await callEdgeFunction('twilioInitiateCall', {
        to: normalized,
        userEmail: userEmail,
        leadId: null,
        leadName: null,
        lineNumber: 1,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to initiate call');
      }

      setCurrentCallSid(response.callSid);
      setCallStatus('ringing');

      twilioClientManager.onCallAnswered(() => {
        setCallStatus('connected');
        toast.success('Call connected');
      });

      twilioClientManager.onCallEnded(async () => {
        await endCall();
      });

      twilioClientManager.onCallError((error) => {
        toast.error(`Call error: ${error.message}`);
        endCall();
      });

    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error(error.message || 'Failed to start call');
      setIsCallActive(false);
      setCallStatus('idle');
    }
  };

  const endCall = async () => {
    try {
      if (currentCallSid) {
        await callEdgeFunction('twilioEndCall', {
          callSid: currentCallSid,
          userEmail: userEmail,
        });
      }

      twilioClientManager.disconnectCall();

      const normalized = normalizePhoneNumber(phoneNumber, preferences?.default_country_code);

      await supabase
        .from('dialer_call_history')
        .update({
          status: 'completed',
          duration: callDuration,
          ended_at: new Date().toISOString(),
        })
        .eq('user_email', userEmail)
        .eq('phone_number', normalized)
        .is('ended_at', null);

      queryClient.invalidateQueries(['dialerCallHistory']);

    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setIsCallActive(false);
      setCallStatus('idle');
      setCallDuration(0);
      setCurrentCallSid(null);
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      twilioClientManager.unmuteCall();
      setIsMuted(false);
      toast.success('Microphone unmuted');
    } else {
      twilioClientManager.muteCall();
      setIsMuted(true);
      toast.success('Microphone muted');
    }
  };

  const handleCallFromHistory = (number) => {
    setPhoneNumber(extractDigits(number));
    setActiveTab('dialer');
  };

  const filteredFavorites = favorites.filter(fav =>
    fav.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fav.phone_number.includes(searchTerm)
  );

  const filteredHistory = callHistory.filter(call =>
    (call.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
    call.phone_number.includes(searchTerm)
  );

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Phone</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Close dialer"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="dialer">
                <Phone className="w-4 h-4 mr-2" />
                Dialer
              </TabsTrigger>
              <TabsTrigger value="favorites">
                <Star className="w-4 h-4 mr-2" />
                Favorites
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dialer" className="space-y-6">
              <div className="text-center">
                <div className="mb-4 min-h-[60px] flex items-center justify-center">
                  {isCallActive ? (
                    <div className="space-y-2">
                      <div className="text-sm text-slate-600 capitalize">{callStatus}</div>
                      {callStatus === 'connected' && (
                        <div className="text-3xl font-mono font-bold text-slate-800">
                          {getCallDurationFormatted(callDuration)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-3xl font-mono font-semibold text-slate-800 tracking-wider">
                      {formatPhoneNumber(phoneNumber, preferences?.number_format_preference) || ' '}
                    </div>
                  )}
                </div>

                {!isCallActive && phoneNumber && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {!isCallActive ? (
                <div className="grid grid-cols-3 gap-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                    <motion.button
                      key={digit}
                      onClick={() => handleNumberInput(digit)}
                      className="aspect-square rounded-2xl bg-slate-100 hover:bg-slate-200 text-2xl font-semibold text-slate-800 transition-all active:scale-95"
                      whileTap={{ scale: 0.95 }}
                      aria-label={`Dial ${digit}`}
                    >
                      {digit}
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4 py-8">
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    size="lg"
                    className="rounded-full h-16 w-16"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                {!isCallActive ? (
                  <>
                    {phoneNumber && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleBackspace}
                        className="rounded-full h-14 w-14"
                        aria-label="Backspace"
                      >
                        <Delete className="w-5 h-5" />
                      </Button>
                    )}
                    <Button
                      onClick={initiateCall}
                      disabled={!phoneNumber}
                      size="lg"
                      className="rounded-full h-14 px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg disabled:opacity-50"
                      aria-label="Call"
                    >
                      <Phone className="w-5 h-5 mr-2" />
                      Call
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={endCall}
                    size="lg"
                    className="rounded-full h-14 px-8 bg-red-600 hover:bg-red-700 text-white shadow-lg"
                    aria-label="End call"
                  >
                    <PhoneOff className="w-5 h-5 mr-2" />
                    End Call
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="favorites" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search favorites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredFavorites.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Star className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>No favorites yet</p>
                    <p className="text-sm mt-1">Add contacts to quickly dial them</p>
                  </div>
                ) : (
                  filteredFavorites.map((favorite) => (
                    <motion.div
                      key={favorite.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleCallFromHistory(favorite.phone_number)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                        {getContactInitials(favorite.name)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{favorite.name}</div>
                        <div className="text-sm text-slate-500">{formatPhoneNumber(favorite.phone_number)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhoneNumber(extractDigits(favorite.phone_number));
                          initiateCall();
                        }}
                        className="rounded-full"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>No call history</p>
                  </div>
                ) : (
                  filteredHistory.map((call) => (
                    <motion.div
                      key={call.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleCallFromHistory(call.phone_number)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        call.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        <Phone className={`w-5 h-5 ${
                          call.direction === 'inbound' ? 'text-blue-600' : 'text-green-600'
                        } ${call.direction === 'inbound' ? 'rotate-180' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">
                          {call.contact_name || formatPhoneNumber(call.phone_number)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {call.duration > 0 ? getCallDurationFormatted(call.duration) : 'Missed'}
                          {' • '}
                          {new Date(call.started_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhoneNumber(extractDigits(call.phone_number));
                          setActiveTab('dialer');
                        }}
                        className="rounded-full"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}
