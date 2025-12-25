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
import { useDialerCallSubscription } from '@/hooks/useDialerCallSubscription';
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
  const [isMuted, setIsMuted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dialer');
  const [callDuration, setCallDuration] = useState(0);

  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  const { currentCall, isConnected, clearCall, updateCallStatus } = useDialerCallSubscription(userEmail);

  const isCallActive = currentCall?.isActive || false;
  const callStatus = currentCall?.status || 'idle';
  const isCallConnected = callStatus === 'in-progress' || callStatus === 'connected';

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

  const { data: dialerSettings } = useQuery({
    queryKey: ['dialerSettings', userEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_settings')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
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

  useEffect(() => {
    if (isCallConnected) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setCallDuration(d => d + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callStatus === 'idle' || !currentCall) {
        setCallDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCallConnected, callStatus, currentCall]);

  const playDialTone = useCallback((digit) => {
    if (!preferences?.enable_dial_tones) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = DIAL_TONES[digit] || 770;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.1);
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
    const useMockMode = dialerSettings?.use_mock_dialer || false;

    try {
      if (useMockMode) {
        toast.info('Demo Mode: Simulating call...');

        const response = await callEdgeFunction('mockDialerCall', {
          to: normalized,
          userEmail: userEmail,
          leadId: null,
          leadName: null,
          lineNumber: 1,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to initiate call');
        }
      } else {
        if (!twilioClientManager.isReady()) {
          const initialized = await twilioClientManager.initialize(userEmail);
          if (!initialized) {
            toast.error('Twilio not configured. Enable Demo Mode in Settings to test.');
            return;
          }
        }

        twilioClientManager.onCallAnswered(() => {
          console.log('Twilio call connected');
        });

        twilioClientManager.onCallEnded(async () => {
          await endCall();
        });

        twilioClientManager.onCallError((error) => {
          toast.error(`Call error: ${error.message}`);
          endCall();
        });

        await twilioClientManager.makeCall(normalized, {
          userEmail: userEmail,
          leadId: null,
          leadName: null,
        });

        toast.success('Calling...');
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error(error.message || 'Failed to start call');
    }
  };

  const endCall = async () => {
    const useMockMode = dialerSettings?.use_mock_dialer || false;

    try {
      if (!useMockMode && twilioClientManager.hasActiveCall()) {
        twilioClientManager.disconnectCall();
      }

      await updateCallStatus('ended', { ended_at: new Date().toISOString() });

      if (useMockMode) {
        toast.success('Demo call ended');
      }

      await queryClient.invalidateQueries(['recentNumbers']);
    } catch (error) {
      console.error('Error ending call:', error);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleMute = () => {
    const useMockMode = dialerSettings?.use_mock_dialer || false;

    if (isMuted) {
      if (!useMockMode) {
        twilioClientManager.unmuteCall();
      }
      setIsMuted(false);
      toast.success(useMockMode ? 'Demo: Microphone unmuted' : 'Microphone unmuted');
    } else {
      if (!useMockMode) {
        twilioClientManager.muteCall();
      }
      setIsMuted(true);
      toast.success(useMockMode ? 'Demo: Microphone muted' : 'Microphone muted');
    }
  };

  const handleCallFromHistory = (number) => {
    setPhoneNumber(extractDigits(number));
    setActiveTab('dialer');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredRecentNumbers = recentNumbers.filter(item =>
    item.phone_number.includes(searchTerm) ||
    (item.contact_name && item.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!onClose) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
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

          {dialerSettings?.use_mock_dialer && (
            <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-cyan-700">Demo Mode Active</span>
              <span className="text-xs text-cyan-600 ml-auto">Calls are simulated</span>
            </div>
          )}

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
              <TabsTrigger value="recent">
                <Clock className="w-4 h-4 mr-2" />
                Recent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dialer" className="space-y-4">
              {isCallActive ? (
                <div className="py-8 text-center space-y-6">
                  <div className="flex items-center justify-center">
                    <div className={`
                      w-20 h-20 rounded-full flex items-center justify-center
                      ${isCallConnected ? 'bg-green-100' : 'bg-blue-100'}
                    `}>
                      <Phone className={`w-10 h-10 ${isCallConnected ? 'text-green-600' : 'text-blue-600 animate-pulse'}`} />
                    </div>
                  </div>

                  <div>
                    <p className="text-lg font-medium text-slate-700">{formatPhoneNumber(phoneNumber)}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {currentCall?.statusInfo?.label || callStatus}
                    </p>
                  </div>

                  {isCallConnected && (
                    <div className="text-3xl font-mono font-bold text-slate-700">
                      {formatTime(callDuration)}
                    </div>
                  )}

                  <div className="flex justify-center gap-4 pt-4">
                    {isCallConnected && (
                      <Button
                        onClick={toggleMute}
                        variant="outline"
                        size="lg"
                        className="rounded-full w-14 h-14 p-0"
                      >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </Button>
                    )}
                    <Button
                      onClick={endCall}
                      size="lg"
                      className="rounded-full w-14 h-14 p-0 bg-red-500 hover:bg-red-600"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-slate-100 rounded-2xl p-4 min-h-[60px] flex items-center justify-center">
                    <input
                      type="tel"
                      value={formatPhoneNumber(phoneNumber)}
                      readOnly
                      placeholder="Enter number"
                      className="bg-transparent text-2xl font-medium text-center w-full outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <button
                        key={digit}
                        onClick={() => handleNumberInput(digit)}
                        className="aspect-square rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors text-xl font-semibold text-slate-700"
                      >
                        {digit}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleBackspace}
                      variant="outline"
                      className="flex-1 rounded-xl"
                      disabled={!phoneNumber}
                    >
                      <Delete className="w-4 h-4 mr-2" />
                      Backspace
                    </Button>
                    <Button
                      onClick={handleClear}
                      variant="outline"
                      className="rounded-xl px-4"
                      disabled={!phoneNumber}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <Button
                    onClick={initiateCall}
                    className="w-full h-14 rounded-2xl bg-green-500 hover:bg-green-600 text-white text-lg font-semibold"
                    disabled={!phoneNumber}
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="favorites" className="space-y-3">
              {favorites.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Star className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No favorites yet</p>
                </div>
              ) : (
                favorites.map((fav) => (
                  <div
                    key={fav.id}
                    onClick={() => handleCallFromHistory(fav.phone_number)}
                    className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-700">{fav.contact_name || 'Unknown'}</p>
                      <p className="text-sm text-slate-500">{formatPhoneNumber(fav.phone_number)}</p>
                    </div>
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="recent" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search recent calls..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredRecentNumbers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>{searchTerm ? 'No matching calls' : 'No recent calls'}</p>
                  </div>
                ) : (
                  filteredRecentNumbers.map((call) => (
                    <div
                      key={call.id}
                      onClick={() => handleCallFromHistory(call.phone_number)}
                      className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-600">
                          {getContactInitials(call.contact_name)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-700">
                          {call.contact_name || formatPhoneNumber(call.phone_number)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(call.last_called_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
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
