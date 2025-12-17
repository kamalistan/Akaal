import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { callStatusManager } from '@/utils/callStatusManager';

export function useActiveCallsSync(userEmail) {
  const [activeLines, setActiveLines] = useState([]);
  const [connectedLine, setConnectedLine] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const terminalTimeoutsRef = useRef(new Map());
  const channelRef = useRef(null);

  const enrichCallData = useCallback((calls) => {
    const uniqueCallSids = new Set();

    return calls
      .filter(call => {
        if (uniqueCallSids.has(call.call_sid)) {
          return false;
        }
        uniqueCallSids.add(call.call_sid);
        return true;
      })
      .map(call => ({
        ...call,
        leadName: call.leads?.name || 'Unknown Lead',
        to_number: call.leads?.phone || call.to_number,
        statusInfo: callStatusManager.getStatusInfo(call.status),
        isActive: callStatusManager.isActiveStatus(call.status),
        isDialing: callStatusManager.isDialingStatus(call.status),
        isTerminal: callStatusManager.isTerminalStatus(call.status),
        progress: callStatusManager.getStatusProgress(call.status),
      }));
  }, []);

  const scheduleTerminalRemoval = useCallback((callSid, delay = 5000) => {
    if (terminalTimeoutsRef.current.has(callSid)) {
      clearTimeout(terminalTimeoutsRef.current.get(callSid));
    }

    const timeoutId = setTimeout(() => {
      setActiveLines(prev => prev.filter(line => line.call_sid !== callSid));
      terminalTimeoutsRef.current.delete(callSid);
      callStatusManager.clearCallState(callSid);
    }, delay);

    terminalTimeoutsRef.current.set(callSid, timeoutId);
  }, []);

  const updateActiveCalls = useCallback((newData) => {
    const enriched = enrichCallData(newData);

    setActiveLines(enriched);

    enriched.forEach(line => {
      if (line.isTerminal) {
        scheduleTerminalRemoval(line.call_sid);
      }
    });

    const connected = enriched.find(line => line.status === 'in-progress');
    setConnectedLine(connected || null);
  }, [enrichCallData, scheduleTerminalRemoval]);

  const fetchActiveCalls = useCallback(async () => {
    if (!userEmail) return;

    try {
      const { data, error } = await supabase
        .from('active_calls')
        .select(`
          *,
          leads:lead_id (
            id,
            name,
            phone,
            company
          )
        `)
        .eq('user_email', userEmail)
        .order('line_number', { ascending: true });

      if (error) throw error;

      if (data) {
        updateActiveCalls(data);
      }
    } catch (error) {
      console.error('Error fetching active calls:', error);
    }
  }, [userEmail, updateActiveCalls]);

  useEffect(() => {
    if (!userEmail) return;

    fetchActiveCalls();

    const channelName = `active_calls_${userEmail}_${Date.now()}`;
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
          console.log('Real-time call update:', payload.eventType, payload.new?.status);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            fetchActiveCalls();
          } else if (payload.eventType === 'DELETE') {
            setActiveLines(prev => prev.filter(line => line.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    const heartbeatInterval = setInterval(() => {
      if (channelRef.current?.state !== 'joined') {
        console.warn('Realtime connection lost, reconnecting...');
        fetchActiveCalls();
      }
    }, 10000);

    return () => {
      clearInterval(heartbeatInterval);
      terminalTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      terminalTimeoutsRef.current.clear();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userEmail, fetchActiveCalls]);

  const removeCompletedLines = useCallback(() => {
    setActiveLines(prev => {
      const nonTerminal = prev.filter(line => !line.isTerminal);
      const terminal = prev.filter(line => line.isTerminal);

      terminal.forEach(line => {
        callStatusManager.clearCallState(line.call_sid);
      });

      return nonTerminal;
    });

    terminalTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    terminalTimeoutsRef.current.clear();
  }, []);

  const getCallByCallSid = useCallback((callSid) => {
    return activeLines.find(line => line.call_sid === callSid);
  }, [activeLines]);

  return {
    activeLines,
    connectedLine,
    hasActiveLines: activeLines.length > 0,
    isConnected,
    refresh: fetchActiveCalls,
    removeCompletedLines,
    getCallByCallSid,
  };
}
