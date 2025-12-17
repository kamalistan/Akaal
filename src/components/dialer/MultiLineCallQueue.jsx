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
  busy: 'bg-red-500',
  'no-answer': 'bg-red-500',
  voicemail_detected: 'bg-orange-500',
  dropped_other_answered: 'bg-slate-400',
  terminated_by_user: 'bg-slate-400',
  canceled: 'bg-red-500',
};

const statusLabels = {
  initiating: 'Dialing',
  queued: 'Dialing',
  ringing: 'Dialing',
  'in-progress': 'Connected',
  answered: 'Answered',
  completed: 'Ended',
  failed: 'Declined',
  busy: 'Declined',
  'no-answer': 'Declined',
  voicemail_detected: 'Voicemail',
  dropped_other_answered: 'Dropped',
  terminated_by_user: 'Ended',
  canceled: 'Declined',
};

export default function MultiLineCallQueue({ activeLines = [] }) {
  if (activeLines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Active Lines</h3>
        <span className="text-xs text-slate-500">{activeLines.length} active</span>
      </div>
      <div className="grid gap-2">
        <AnimatePresence mode="popLayout">
          {activeLines.map((line, index) => {
            const Icon = statusIcons[line.status] || Phone;
            const colorClass = statusColors[line.status] || 'bg-slate-500';
            const label = statusLabels[line.status] || line.status;
            const isActive = line.isActive || false;
            const isSpinning = line.isDialing || false;
            const isTerminal = line.isTerminal || false;

            return (
              <motion.div
                key={line.call_sid || `line-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                transition={{ duration: 0.3 }}
                layout
              >
                <Card className={`p-3 transition-all ${isActive ? 'ring-2 ring-green-500 ring-offset-2 shadow-lg' : ''} ${isTerminal ? 'opacity-75' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${colorClass} relative`}>
                      <Icon className={`w-4 h-4 text-white ${isSpinning ? 'animate-spin' : ''}`} />
                      {isActive && (
                        <motion.div
                          className="absolute -inset-1 rounded-full border-2 border-green-500"
                          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
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
                      {line.progress !== undefined && !isTerminal && (
                        <div className="mt-2">
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full ${colorClass}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${line.progress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      )}
                      {line.error_message && (
                        <p className="text-xs text-red-600 mt-1 truncate">
                          {line.error_message}
                        </p>
                      )}
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
