import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useActiveCallsSync(userEmail) {
  const [activeLines, setActiveLines] = useState([]);
  const [connectedLine, setConnectedLine] = useState(null);

  const fetchActiveCalls = useCallback(async () => {
    if (!userEmail) return;

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
      .in('status', ['initiating', 'queued', 'ringing', 'in-progress', 'busy', 'canceled', 'failed', 'no-answer', 'completed', 'voicemail_detected', 'terminated_by_user'])
      .order('line_number', { ascending: true });

    if (!error && data) {
      const uniqueCallSids = new Set();
      const terminalStatuses = ['completed', 'failed', 'busy', 'no-answer', 'canceled', 'voicemail_detected', 'terminated_by_user', 'dropped_other_answered'];

      const enrichedLines = data
        .filter(call => {
          if (uniqueCallSids.has(call.call_sid)) {
            return false;
          }
          uniqueCallSids.add(call.call_sid);
          return true;
        })
        .map(call => ({
          ...call,
          leadName: call.leads?.name,
          to_number: call.leads?.phone,
        }));

      setActiveLines(enrichedLines);

      enrichedLines.forEach(line => {
        if (terminalStatuses.includes(line.status)) {
          setTimeout(() => {
            setActiveLines(prev =>
              prev.filter(l => l.call_sid !== line.call_sid)
            );
          }, 2500);
        }
      });

      const connected = enrichedLines.find(line => line.status === 'in-progress');
      setConnectedLine(connected || null);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;

    fetchActiveCalls();

    const channel = supabase
      .channel(`active_calls_${userEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_calls',
          filter: `user_email=eq.${userEmail}`,
        },
        (payload) => {
          console.log('Active call update:', payload);
          fetchActiveCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail, fetchActiveCalls]);

  const removeCompletedLines = useCallback(() => {
    setActiveLines(prev =>
      prev.filter(line => !['completed', 'failed', 'busy', 'no-answer', 'dropped_other_answered', 'voicemail_detected'].includes(line.status))
    );
  }, []);

  return {
    activeLines,
    connectedLine,
    hasActiveLines: activeLines.length > 0,
    refresh: fetchActiveCalls,
    removeCompletedLines,
  };
}
