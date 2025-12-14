import React from 'react';
import { motion } from 'framer-motion';

export default function MascotCharacter({ mood = 'neutral', size = 'lg' }) {
  const sizeClasses = {
    sm: 'w-24 h-32',
    md: 'w-32 h-44',
    lg: 'w-48 h-64',
    xl: 'w-64 h-80'
  };

  const moodExpressions = {
    happy: { leftEye: '•', rightEye: '•', mouth: '◡' },
    neutral: { leftEye: '•', rightEye: '•', mouth: '—' },
    excited: { leftEye: '★', rightEye: '★', mouth: 'D' },
    sleepy: { leftEye: '—', rightEye: '—', mouth: 'o' }
  };

  const expression = moodExpressions[mood] || moodExpressions.neutral;

  return (
    <motion.div 
      className={`${sizeClasses[size]} relative flex items-center justify-center`}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/30 to-purple-400/20 rounded-full blur-3xl scale-150" />
      
      {/* Body */}
      <div className="relative">
        {/* Head/Body combined - pill shape */}
        <motion.div 
          className="relative bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 rounded-[40%] shadow-2xl"
          style={{
            width: size === 'xl' ? '180px' : size === 'lg' ? '140px' : size === 'md' ? '100px' : '70px',
            height: size === 'xl' ? '200px' : size === 'lg' ? '160px' : size === 'md' ? '120px' : '90px',
          }}
          whileHover={{ scale: 1.02 }}
        >
          {/* Face */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
            {/* Eyes */}
            <div className="flex gap-6 mb-2">
              <motion.span 
                className="text-2xl text-slate-700"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {expression.leftEye}
              </motion.span>
              <motion.span 
                className="text-2xl text-slate-700"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
              >
                {expression.rightEye}
              </motion.span>
            </div>
            {/* Mouth */}
            <span className="text-xl text-slate-600">{expression.mouth}</span>
          </div>
          
          {/* Shine effect */}
          <div className="absolute top-4 left-6 w-6 h-6 bg-white/60 rounded-full blur-sm" />
        </motion.div>

        {/* Arms */}
        <motion.div 
          className="absolute -left-4 top-1/2 w-6 h-16 bg-gradient-to-b from-slate-100 to-slate-200 rounded-full shadow-lg"
          animate={{ rotate: [-5, 5, -5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div 
          className="absolute -right-4 top-1/2 w-6 h-16 bg-gradient-to-b from-slate-100 to-slate-200 rounded-full shadow-lg"
          animate={{ rotate: [5, -5, 5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Legs */}
        <div className="flex justify-center gap-4 -mt-2">
          <div className="w-6 h-10 bg-gradient-to-b from-slate-200 to-slate-300 rounded-full shadow-md" />
          <div className="w-6 h-10 bg-gradient-to-b from-slate-200 to-slate-300 rounded-full shadow-md" />
        </div>
      </div>
    </motion.div>
  );
}