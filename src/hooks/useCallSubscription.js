import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useCallSubscription(userEmail, leadId) {
  const [currentCall, setCurrentCall] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const isLoadingRef = useRef(false);

  const isTerminalStatus = (status) => {
    return ['completed', 'ended', 'failed', 'busy', 'no-answer', 'canceled', 'voicemail_detected'].includes(status);
  };

  const isActiveStatus = (status) => {
    return ['dialing', 'queued', 'ringing', 'in-progress', 'connected', 'initiating'].includes(status);
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'dialing': { label: 'Dialing...', color: 'text-blue-600', bgColor: 'bg-blue-100' },
      'initiating': { label: 'Initiating...', color: 'text-blue-600', bgColor: 'bg-blue-100' },
      'queued': { label: 'Queued', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
      'ringing': { label: 'Ringing...', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
      'in-progress': { label: 'Connected', color: 'text-green-600', bgColor: 'bg-green-100' },
      'connected': { label: 'Connected', color: 'text-green-600', bgColor: 'bg-green-100' },
      'completed': { label: 'Ended', color: 'text-slate-600', bgColor: 'bg-slate-100' },
      'ended': { label: 'Ended', color: 'text-slate-600', bgColor: 'bg-slate-100' },
      'failed': { label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-100' },
      'busy': { label: 'Busy', color: 'text-orange-600', bgColor: 'bg-orange-100' },
      'no-answer': { label: 'No Answer', color: 'text-slate-600', bgColor: 'bg-slate-100' },
      'canceled': { label: 'Canceled', color: 'text-slate-600', bgColor: 'bg-slate-100' },
      'voicemail_detected': { label: 'Voicemail', color: 'text-purple-600', bgColor: 'bg-purple-100' },
    };
    return statusMap[status] || { label: status, color: 'text-slate-600', bgColor: 'bg-slate-100' };
  };

  const enrichCallData = useCallback((call) => {
    if (!call) return null;
    return {
      ...call,
      statusInfo: getStatusInfo(call.status),
      isActive: isActiveStatus(call.status),
      isTerminal: isTerminalStatus(call.status),
      secondsSinceStart: call.started_at
        ? Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000)
        : 0,
    };
  }, []);

  const fetchCurrentCall = useCallback(async () => {
    if (!userEmail || !leadId || isLoadingRef.current) return;

    isLoadingRef.current = true;
    try {
      const { data, error: fetchError } = await supabase
        .from('active_calls')
        .select('*')
        .eq('user_email', userEmail)
        .eq('lead_id', leadId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const enriched = enrichCallData(data);
      setCurrentCall(enriched);
      setError(null);
    } catch (err) {
      console.error('Error fetching current call:', err);
      setError(err.message);
    } finally {
      isLoadingRef.current = false;
    }
  }, [userEmail, leadId, enrichCallData]);

  useEffect(() => {
    if (!userEmail || !leadId) {
      setCurrentCall(null);
      return;
    }

    fetchCurrentCall();

    const channelName = `call_${userEmail}_${leadId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_calls',
          filter: `user_email=eq.${userEmail}`,
        },
        (payload) => {
          console.log('Call update received:', payload.eventType, payload.new?.status);

          if (payload.eventType === 'DELETE') {
            if (payload.old.lead_id === leadId) {
              setCurrentCall(null);
            }
          } else if (payload.new && payload.new.lead_id === leadId) {
            const enriched = enrichCallData(payload.new);
            setCurrentCall(enriched);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userEmail, leadId, fetchCurrentCall, enrichCallData]);

  const clearCall = useCallback(async () => {
    if (currentCall?.call_sid) {
      await supabase
        .from('active_calls')
        .delete()
        .eq('call_sid', currentCall.call_sid);

      setCurrentCall(null);
    }
  }, [currentCall]);

  const updateCallStatus = useCallback(async (newStatus, additionalData = {}) => {
    if (!currentCall?.call_sid) return;

    const { error: updateError } = await supabase
      .from('active_calls')
      .update({
        status: newStatus,
        ...additionalData,
      })
      .eq('call_sid', currentCall.call_sid);

    if (updateError) {
      console.error('Error updating call status:', updateError);
      throw updateError;
    }
  }, [currentCall]);

  return {
    currentCall,
    isConnected,
    error,
    refresh: fetchCurrentCall,
    clearCall,
    updateCallStatus,
    isActive: currentCall?.isActive || false,
    isTerminal: currentCall?.isTerminal || false,
  };
}
