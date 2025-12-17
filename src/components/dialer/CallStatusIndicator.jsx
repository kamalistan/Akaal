import React from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneCall, Voicemail, PhoneOff, PhoneMissed, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const statusConfig = {
  queued: {
    label: 'Initiating Call...',
    icon: Loader2,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    christmasColor: 'bg-red-500',
    christmasTextColor: 'text-red-700',
    christmasBorderColor: 'border-red-500',
    animate: true,
  },
  initiated: {
    label: 'Dialing...',
    icon: Phone,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    christmasColor: 'bg-red-500',
    christmasTextColor: 'text-red-700',
    christmasBorderColor: 'border-red-500',
    animate: true,
  },
  ringing: {
    label: 'Ringing...',
    icon: PhoneCall,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-500',
    christmasColor: 'bg-green-500',
    christmasTextColor: 'text-green-700',
    christmasBorderColor: 'border-green-500',
    animate: true,
  },
  'in-progress': {
    label: 'Connected',
    icon: PhoneCall,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-500',
    christmasColor: 'bg-green-600',
    christmasTextColor: 'text-green-800',
    christmasBorderColor: 'border-green-600',
    animate: false,
  },
  completed: {
    label: 'Call Ended',
    icon: PhoneOff,
    color: 'bg-slate-500',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-500',
    christmasColor: 'bg-slate-500',
    christmasTextColor: 'text-slate-700',
    christmasBorderColor: 'border-slate-500',
    animate: false,
  },
  busy: {
    label: 'Line Busy',
    icon: PhoneOff,
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-500',
    christmasColor: 'bg-orange-500',
    christmasTextColor: 'text-orange-700',
    christmasBorderColor: 'border-orange-500',
    animate: false,
  },
  failed: {
    label: 'Call Failed',
    icon: PhoneOff,
    color: 'bg-red-500',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
    christmasColor: 'bg-red-600',
    christmasTextColor: 'text-red-800',
    christmasBorderColor: 'border-red-600',
    animate: false,
  },
  'no-answer': {
    label: 'No Answer',
    icon: PhoneMissed,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-500',
    christmasColor: 'bg-yellow-500',
    christmasTextColor: 'text-yellow-700',
    christmasBorderColor: 'border-yellow-500',
    animate: false,
  },
  canceled: {
    label: 'Call Canceled',
    icon: PhoneOff,
    color: 'bg-slate-500',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-500',
    christmasColor: 'bg-slate-500',
    christmasTextColor: 'text-slate-700',
    christmasBorderColor: 'border-slate-500',
    animate: false,
  },
};

export default function CallStatusIndicator({ status, className = '' }) {
  const { theme } = useTheme();
  const isChristmas = theme === 'christmas';

  if (!status) return null;

  const config = statusConfig[status] || statusConfig.queued;
  const Icon = config.icon;

  const bgColor = isChristmas ? config.christmasColor : config.color;
  const textColor = isChristmas ? config.christmasTextColor : config.textColor;
  const borderColor = isChristmas ? config.christmasBorderColor : config.borderColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${borderColor} ${bgColor} bg-opacity-20 backdrop-blur-sm ${className}`}
    >
      <motion.div
        animate={config.animate ? { rotate: 360 } : {}}
        transition={config.animate ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
      >
        <Icon className={`w-5 h-5 ${textColor}`} />
      </motion.div>

      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${textColor}`}>
          {config.label}
        </span>
      </div>

      {config.animate && (
        <motion.div
          className={`w-2 h-2 rounded-full ${bgColor}`}
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
