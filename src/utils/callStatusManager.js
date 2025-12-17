import { supabase } from '@/lib/supabase';

const CALL_STATUS_STAGES = {
  initiating: { order: 1, label: 'Initiating', isTerminal: false, color: 'blue' },
  queued: { order: 2, label: 'Queued', isTerminal: false, color: 'blue' },
  ringing: { order: 3, label: 'Ringing', isTerminal: false, color: 'yellow' },
  answered: { order: 4, label: 'Answered', isTerminal: false, color: 'green' },
  'in-progress': { order: 5, label: 'Connected', isTerminal: false, color: 'green' },
  completed: { order: 6, label: 'Completed', isTerminal: true, color: 'slate' },
  failed: { order: 6, label: 'Failed', isTerminal: true, color: 'red' },
  busy: { order: 6, label: 'Busy', isTerminal: true, color: 'red' },
  'no-answer': { order: 6, label: 'No Answer', isTerminal: true, color: 'red' },
  canceled: { order: 6, label: 'Canceled', isTerminal: true, color: 'red' },
  voicemail_detected: { order: 6, label: 'Voicemail', isTerminal: true, color: 'orange' },
  dropped_other_answered: { order: 6, label: 'Dropped', isTerminal: true, color: 'slate' },
  terminated_by_user: { order: 6, label: 'Ended', isTerminal: true, color: 'slate' },
};

class CallStatusManager {
  constructor() {
    this.listeners = new Map();
    this.callStates = new Map();
    this.statusHistory = new Map();
  }

  getStatusInfo(status) {
    return CALL_STATUS_STAGES[status] || {
      order: 0,
      label: status,
      isTerminal: false,
      color: 'slate'
    };
  }

  isTerminalStatus(status) {
    return CALL_STATUS_STAGES[status]?.isTerminal || false;
  }

  isActiveStatus(status) {
    return ['ringing', 'in-progress', 'answered'].includes(status);
  }

  isDialingStatus(status) {
    return ['initiating', 'queued', 'ringing'].includes(status);
  }

  canTransition(currentStatus, newStatus) {
    const current = this.getStatusInfo(currentStatus);
    const next = this.getStatusInfo(newStatus);

    if (current.isTerminal) {
      return false;
    }

    if (next.order >= current.order) {
      return true;
    }

    if (next.isTerminal) {
      return true;
    }

    return false;
  }

  async updateCallStatus(callSid, newStatus, source = 'system', metadata = {}) {
    try {
      const { data: currentCall, error: fetchError } = await supabase
        .from('active_calls')
        .select('*')
        .eq('call_sid', callSid)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!currentCall) {
        console.warn(`Call ${callSid} not found in active_calls`);
        return { success: false, error: 'Call not found' };
      }

      if (!this.canTransition(currentCall.status, newStatus)) {
        console.warn(`Invalid transition: ${currentCall.status} -> ${newStatus}`);
        return { success: false, error: 'Invalid status transition' };
      }

      const updateData = {
        status: newStatus,
        status_source: source,
        status_changed_at: new Date().toISOString(),
        ...metadata
      };

      if (newStatus === 'answered' || newStatus === 'in-progress') {
        updateData.answered_at = updateData.answered_at || new Date().toISOString();
      }

      if (this.isTerminalStatus(newStatus)) {
        updateData.ended_at = updateData.ended_at || new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('active_calls')
        .update(updateData)
        .eq('call_sid', callSid);

      if (updateError) throw updateError;

      this.callStates.set(callSid, {
        ...currentCall,
        ...updateData
      });

      this.notifyListeners(callSid, newStatus, currentCall.status);

      return { success: true, previousStatus: currentCall.status, newStatus };
    } catch (error) {
      console.error('Error updating call status:', error);
      return { success: false, error: error.message };
    }
  }

  async getCallHistory(callSid) {
    try {
      const { data, error } = await supabase
        .rpc('get_call_status_timeline', { p_call_sid: callSid });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching call history:', error);
      return [];
    }
  }

  subscribe(callSid, callback) {
    if (!this.listeners.has(callSid)) {
      this.listeners.set(callSid, new Set());
    }
    this.listeners.get(callSid).add(callback);

    return () => {
      const callbacks = this.listeners.get(callSid);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(callSid);
        }
      }
    };
  }

  notifyListeners(callSid, newStatus, previousStatus) {
    const callbacks = this.listeners.get(callSid);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ callSid, newStatus, previousStatus, timestamp: new Date() });
        } catch (error) {
          console.error('Error in status listener:', error);
        }
      });
    }
  }

  getCallState(callSid) {
    return this.callStates.get(callSid);
  }

  clearCallState(callSid) {
    this.callStates.delete(callSid);
    this.listeners.delete(callSid);
    this.statusHistory.delete(callSid);
  }

  async cleanupTerminalCalls(userEmail, olderThanSeconds = 300) {
    try {
      const cutoffTime = new Date(Date.now() - olderThanSeconds * 1000).toISOString();

      const { error } = await supabase
        .from('active_calls')
        .delete()
        .eq('user_email', userEmail)
        .in('status', [
          'completed',
          'failed',
          'busy',
          'no-answer',
          'canceled',
          'voicemail_detected',
          'dropped_other_answered',
          'terminated_by_user'
        ])
        .lt('ended_at', cutoffTime);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error cleaning up terminal calls:', error);
      return { success: false, error: error.message };
    }
  }

  async getActiveCallsForUser(userEmail) {
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
        .not('status', 'in', '(completed,failed,busy,no-answer,canceled,voicemail_detected,dropped_other_answered,terminated_by_user)')
        .order('line_number', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching active calls:', error);
      return [];
    }
  }

  getStatusProgress(status) {
    const info = this.getStatusInfo(status);
    const maxOrder = 5;
    return Math.min((info.order / maxOrder) * 100, 100);
  }

  getEstimatedTimeRemaining(status) {
    const estimates = {
      initiating: 3,
      queued: 2,
      ringing: 15,
      answered: 0,
      'in-progress': 0,
    };
    return estimates[status] || 0;
  }
}

export const callStatusManager = new CallStatusManager();
export { CALL_STATUS_STAGES };
