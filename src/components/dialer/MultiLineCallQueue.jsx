import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneCall, PhoneMissed, Loader2, VoicemailIcon, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

const statusIcons = {
  initiating: Loader2,
  queued: Loader2,
  ringing: PhoneCall,
  'in-progress': Phone,
  answered: CheckCircle2,
  completed: CheckCircle2,
  failed: XCircle,
  busy: PhoneMissed,
  'no-answer': PhoneMissed,
  voicemail_detected: VoicemailIcon,
  dropped_other_answered: XCircle,
  terminated_by_user: XCircle,
  canceled: XCircle,
};

const statusColors = {
  initiating: 'bg-blue-500',
  queued: 'bg-blue-500',
  ringing: 'bg-yellow-500',
  'in-progress': 'bg-green-500',
  answered: 'bg-green-500',
  completed: 'bg-slate-400',
  failed: 'bg-red-500',
  busy: 'bg-orange-500',
  'no-answer': 'bg-slate-400',
  voicemail_detected: 'bg-purple-500',
  dropped_other_answered: 'bg-slate-400',
  terminated_by_user: 'bg-slate-400',
  canceled: 'bg-slate-400',
};

const statusLabels = {
  initiating: 'Initiating',
  queued: 'Queued',
  ringing: 'Ringing',
  'in-progress': 'Connected',
  answered: 'Answered',
  completed: 'Completed',
  failed: 'Failed',
  busy: 'Busy',
  'no-answer': 'No Answer',
  voicemail_detected: 'Voicemail',
  dropped_other_answered: 'Dropped',
  terminated_by_user: 'Ended',
  canceled: 'Canceled',
};

export default function MultiLineCallQueue({ activeLines = [] }) {
  if (activeLines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      <h3 className="text-sm font-semibold text-slate-700">Active Lines</h3>
      <div className="grid gap-2">
        <AnimatePresence mode="popLayout">
          {activeLines.map((line, index) => {
            const Icon = statusIcons[line.status] || Phone;
            const colorClass = statusColors[line.status] || 'bg-slate-500';
            const label = statusLabels[line.status] || line.status;
            const isActive = ['ringing', 'in-progress', 'answered'].includes(line.status);
            const isSpinning = ['initiating', 'queued'].includes(line.status);

            return (
              <motion.div
                key={line.call_sid || `line-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                layout
              >
                <Card className={`p-3 ${isActive ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${colorClass}`}>
                      <Icon className={`w-4 h-4 text-white ${isSpinning ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {line.leadName || 'Unknown Lead'}
                        </p>
                        <span className="text-xs font-medium text-slate-500">
                          Line {line.line_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500 truncate">
                          {line.to_number || 'Connecting...'}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} text-white`}>
                          {label}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
