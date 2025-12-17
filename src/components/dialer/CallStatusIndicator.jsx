import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneCall, Voicemail, PhoneOff, PhoneMissed, Loader2, CheckCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { callStatusManager } from '@/utils/callStatusManager';

const statusConfig = {
  initiating: {
    label: 'Initiating',
    icon: Loader2,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    animate: true,
    stage: 1,
  },
  queued: {
    label: 'Queued',
    icon: Loader2,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    animate: true,
    stage: 2,
  },
  ringing: {
    label: 'Ringing',
    icon: PhoneCall,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-500',
    animate: true,
    stage: 3,
  },
  answered: {
    label: 'Answered',
    icon: CheckCircle,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    borderColor: 'border-green-500',
    animate: false,
    stage: 4,
  },
  'in-progress': {
    label: 'Connected',
    icon: PhoneCall,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    borderColor: 'border-green-500',
    animate: false,
    stage: 5,
  },
  completed: {
    label: 'Completed',
    icon: PhoneOff,
    color: 'bg-slate-500',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-500',
    animate: false,
    stage: 6,
  },
  busy: {
    label: 'Busy',
    icon: PhoneOff,
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-500',
    animate: false,
    stage: 6,
  },
  failed: {
    label: 'Failed',
    icon: PhoneOff,
    color: 'bg-red-500',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
    animate: false,
    stage: 6,
  },
  'no-answer': {
    label: 'No Answer',
    icon: PhoneMissed,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-500',
    animate: false,
    stage: 6,
  },
  canceled: {
    label: 'Canceled',
    icon: PhoneOff,
    color: 'bg-slate-500',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-500',
    animate: false,
    stage: 6,
  },
  voicemail_detected: {
    label: 'Voicemail',
    icon: Voicemail,
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-500',
    animate: false,
    stage: 6,
  },
};

const stages = [
  { key: 'initiating', label: 'Start' },
  { key: 'queued', label: 'Queue' },
  { key: 'ringing', label: 'Ring' },
  { key: 'answered', label: 'Answer' },
  { key: 'in-progress', label: 'Talk' },
];

export default function CallStatusIndicator({ status, showProgress = true, className = '', duration = 0 }) {
  const { theme } = useTheme();
  const [timeInStatus, setTimeInStatus] = useState(0);

  useEffect(() => {
    setTimeInStatus(0);
    const interval = setInterval(() => {
      setTimeInStatus(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  if (!status) return null;

  const config = statusConfig[status] || statusConfig.queued;
  const Icon = config.icon;
  const statusInfo = callStatusManager.getStatusInfo(status);
  const progress = callStatusManager.getStatusProgress(status);

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${config.borderColor} bg-white shadow-sm`}
      >
        <motion.div
          animate={config.animate ? { rotate: 360 } : {}}
          transition={config.animate ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
          className={`p-2 rounded-full ${config.color}`}
        >
          <Icon className="w-5 h-5 text-white" />
        </motion.div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${config.textColor}`}>
              {config.label}
            </span>
            {timeInStatus > 0 && (
              <span className="text-xs text-slate-500 font-mono">
                {formatTime(timeInStatus)}
              </span>
            )}
          </div>
          {duration > 0 && status === 'in-progress' && (
            <div className="text-xs text-slate-500 mt-0.5">
              Call Duration: {formatTime(duration)}
            </div>
          )}
        </div>

        {config.animate && (
          <motion.div
            className={`w-2 h-2 rounded-full ${config.color}`}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>

      {showProgress && !statusInfo.isTerminal && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 ${config.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <div className="flex justify-between mt-3">
            {stages.map((stage, index) => {
              const stageConfig = statusConfig[stage.key];
              const isActive = stageConfig.stage <= config.stage;
              const isCurrent = stage.key === status;

              return (
                <div key={stage.key} className="flex flex-col items-center gap-1 flex-1">
                  <motion.div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCurrent
                        ? `${stageConfig.borderColor} ${stageConfig.color} border-2`
                        : isActive
                        ? 'bg-green-500 border-green-500'
                        : 'bg-slate-200 border-slate-200'
                    }`}
                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {isActive && !isCurrent && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </motion.div>
                  <span className={`text-xs ${isActive ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
