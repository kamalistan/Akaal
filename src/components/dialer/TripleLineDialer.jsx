import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, PhoneCall, Volume2, VolumeX, AlertCircle, CheckCircle2 } from 'lucide-react';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useActiveCallsSync } from '@/hooks/useActiveCallsSync';

const LINE_STATUS_COLORS = {
  idle: 'bg-gray-300 dark:bg-gray-700',
  initiating: 'bg-yellow-500',
  queued: 'bg-yellow-500',
  ringing: 'bg-blue-500 animate-pulse',
  'in-progress': 'bg-green-500',
  connected: 'bg-green-500',
  voicemail_detected: 'bg-orange-500',
  completed: 'bg-gray-400',
  failed: 'bg-red-500',
  busy: 'bg-red-500',
  'no-answer': 'bg-gray-400',
  canceled: 'bg-gray-400',
};

const LINE_STATUS_TEXT = {
  idle: 'Ready',
  initiating: 'Dialing...',
  queued: 'Queued',
  ringing: 'Ringing',
  'in-progress': 'Connected',
  connected: 'Human!',
  voicemail_detected: 'Voicemail',
  completed: 'Ended',
  failed: 'Failed',
  busy: 'Busy',
  'no-answer': 'No Answer',
  canceled: 'Canceled',
};

function CallLineCard({ lineNumber, call, onHangup }) {
  const status = call?.status || 'idle';
  const leadName = call?.lead_name || call?.contact_name || 'Line ' + lineNumber;
  const leadPhone = call?.lead_phone || call?.phone_number || '';

  const isActive = ['initiating', 'queued', 'ringing', 'in-progress', 'connected'].includes(status);
  const isHuman = status === 'connected';
  const isVoicemail = status === 'voicemail_detected';

  return (
    <Card className={`relative ${isHuman ? 'ring-2 ring-green-500' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${LINE_STATUS_COLORS[status]}`} />
              <span className="text-sm font-medium">Line {lineNumber}</span>
            </div>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {LINE_STATUS_TEXT[status]}
            </Badge>
          </div>

          {/* Call Info */}
          {call ? (
            <div className="space-y-1">
              <div className="font-medium truncate">{leadName}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{leadPhone}</div>

              {isHuman && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium pt-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Human detected - You're connected!
                </div>
              )}

              {isVoicemail && (
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Voicemail detected
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Waiting for call...</div>
          )}

          {/* Actions */}
          {isActive && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onHangup(call?.call_sid, lineNumber)}
              className="w-full"
            >
              <PhoneOff className="h-3.5 w-3.5 mr-2" />
              Hang Up
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TripleLineDialer({
  userEmail,
  sessionId,
  onCallConnected,
  onBatchComplete,
  className = ''
}) {
  const [dialing, setDialing] = useState(false);
  const [muted, setMuted] = useState(false);
  const activeCalls = useActiveCallsSync(userEmail);

  // Group calls by line number
  const linesCalls = {
    1: activeCalls.find(c => c.line_number === 1),
    2: activeCalls.find(c => c.line_number === 2),
    3: activeCalls.find(c => c.line_number === 3),
  };

  // Check if any line has human connected
  useEffect(() => {
    const connectedCall = activeCalls.find(c => c.status === 'connected');
    if (connectedCall) {
      onCallConnected?.(connectedCall);
    }
  }, [activeCalls]);

  // Check if all calls are complete
  useEffect(() => {
    if (activeCalls.length === 0 && dialing) {
      setDialing(false);
      onBatchComplete?.();
    }
  }, [activeCalls, dialing]);

  const handleStartTripleDialing = async (leads) => {
    if (!leads || leads.length === 0) {
      toast.error('No leads to dial');
      return;
    }

    setDialing(true);
    try {
      const response = await callEdgeFunction('tripleLineDialer', {
        userEmail: userEmail || 'demo@example.com',
        sessionId,
        leads: leads.slice(0, 3), // Take up to 3 leads
        enableAMD: true,
        amdSensitivity: 'medium',
      });

      if (response.success) {
        toast.success(`Dialing ${response.calls.length} leads simultaneously`);
      } else {
        toast.error(response.error || 'Failed to start dialing');
        setDialing(false);
      }
    } catch (error) {
      console.error('Error starting triple dial:', error);
      toast.error(error.message || 'Failed to start dialing');
      setDialing(false);
    }
  };

  const handleHangup = async (callSid, lineNumber) => {
    if (!callSid) return;

    try {
      const response = await callEdgeFunction('twilioEndCall', {
        callSid,
        userEmail: userEmail || 'demo@example.com',
      });

      if (response.success) {
        toast.success(`Ended call on Line ${lineNumber}`);
      }
    } catch (error) {
      console.error('Error hanging up:', error);
      toast.error('Failed to hang up call');
    }
  };

  const handleStopAll = async () => {
    for (const call of activeCalls) {
      if (call.call_sid) {
        await handleHangup(call.call_sid, call.line_number);
      }
    }
    setDialing(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Triple-Line Dialer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Call 3 leads at once, connect to first human
          </p>
        </div>
        <div className="flex gap-2">
          {activeCalls.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopAll}
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              Stop All
            </Button>
          )}
        </div>
      </div>

      {/* Call Lines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CallLineCard
          lineNumber={1}
          call={linesCalls[1]}
          onHangup={handleHangup}
        />
        <CallLineCard
          lineNumber={2}
          call={linesCalls[2]}
          onHangup={handleHangup}
        />
        <CallLineCard
          lineNumber={3}
          call={linesCalls[3]}
          onHangup={handleHangup}
        />
      </div>

      {/* Status Bar */}
      {activeCalls.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PhoneCall className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                <div>
                  <div className="font-medium">Active Calls: {activeCalls.length}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Waiting for human to answer...
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMuted(!muted)}
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card when idle */}
      {activeCalls.length === 0 && !dialing && (
        <Card className="bg-gray-50 dark:bg-gray-900">
          <CardContent className="p-6 text-center">
            <Phone className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <h4 className="font-medium mb-2">Ready to Dial</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The dialer will call 3 leads at once. When a human answers, you'll be instantly connected
              and the other calls will be automatically disconnected.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Export the start function for external use
export function startTripleDialing(userEmail, sessionId, leads) {
  return callEdgeFunction('tripleLineDialer', {
    userEmail: userEmail || 'demo@example.com',
    sessionId,
    leads: leads.slice(0, 3),
    enableAMD: true,
    amdSensitivity: 'medium',
  });
}
