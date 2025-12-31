import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PhoneCall, Voicemail, PhoneOff, PhoneMissed, Calendar, XCircle, Ban, AlertCircle } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabase';
import { toast } from 'sonner';

const DISPOSITIONS = [
  {
    value: 'connected',
    label: 'Connected',
    icon: PhoneCall,
    description: 'Spoke with contact',
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    value: 'voicemail',
    label: 'Voicemail',
    icon: Voicemail,
    description: 'Left voicemail',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    value: 'no-answer',
    label: 'No Answer',
    icon: PhoneMissed,
    description: 'No one answered',
    color: 'bg-gray-500 hover:bg-gray-600',
  },
  {
    value: 'busy',
    label: 'Busy',
    icon: PhoneOff,
    description: 'Line was busy',
    color: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    value: 'callback',
    label: 'Callback',
    icon: Calendar,
    description: 'Schedule callback',
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    value: 'not-interested',
    label: 'Not Interested',
    icon: XCircle,
    description: 'Declined offer',
    color: 'bg-red-500 hover:bg-red-600',
  },
  {
    value: 'wrong-number',
    label: 'Wrong Number',
    icon: AlertCircle,
    description: 'Invalid contact',
    color: 'bg-yellow-500 hover:bg-yellow-600',
  },
  {
    value: 'dnc',
    label: 'Do Not Call',
    icon: Ban,
    description: 'Add to DNC list',
    color: 'bg-red-700 hover:bg-red-800',
  },
];

export function CallDispositionModal({
  open,
  onOpenChange,
  callData,
  onDispositionSaved
}) {
  const [selectedDisposition, setSelectedDisposition] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedDisposition) {
      toast.error('Please select a disposition');
      return;
    }

    setSaving(true);
    try {
      const response = await callEdgeFunction('callDisposition', {
        callSid: callData?.callSid,
        leadId: callData?.leadId,
        userEmail: callData?.userEmail || 'demo@example.com',
        phoneNumber: callData?.phoneNumber,
        contactName: callData?.contactName || callData?.leadName,
        outcome: selectedDisposition,
        notes: notes.trim() || null,
        duration: callData?.duration || 0,
        startedAt: callData?.startedAt,
        answeredAt: callData?.answeredAt,
        endedAt: callData?.endedAt || new Date().toISOString(),
        wasVoicemail: selectedDisposition === 'voicemail',
      });

      if (response.success) {
        toast.success('Call disposition saved');
        onDispositionSaved?.(selectedDisposition, notes);
        onOpenChange(false);
        setSelectedDisposition(null);
        setNotes('');
      } else {
        toast.error(response.error || 'Failed to save disposition');
      }
    } catch (error) {
      console.error('Error saving disposition:', error);
      toast.error('Failed to save disposition');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Call Outcome</DialogTitle>
          <DialogDescription>
            How did the call go? Select an outcome to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Disposition Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DISPOSITIONS.map((disposition) => {
              const Icon = disposition.icon;
              const isSelected = selectedDisposition === disposition.value;

              return (
                <button
                  key={disposition.value}
                  onClick={() => setSelectedDisposition(disposition.value)}
                  className={`
                    relative flex flex-col items-center gap-2 p-4 rounded-lg
                    border-2 transition-all
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <div className={`p-2 rounded-lg ${disposition.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{disposition.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {disposition.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notes (Optional)
            </label>
            <Textarea
              placeholder="Add any notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Call Info */}
          {callData && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>Contact: {callData.contactName || callData.phoneNumber}</div>
              {callData.duration > 0 && (
                <div>Duration: {Math.floor(callData.duration / 60)}m {callData.duration % 60}s</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedDisposition || saving}
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
