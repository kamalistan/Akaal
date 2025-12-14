import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function PointsPopup({ points, isVisible, onComplete }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={() => {
            setTimeout(onComplete, 1500);
          }}
        >
          <motion.div 
            className="bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 rounded-3xl p-8 shadow-2xl shadow-yellow-500/50"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, y: -100 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <div className="flex flex-col items-center text-white">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                <Sparkles className="w-12 h-12 mb-2" />
              </motion.div>
              <motion.span 
                className="text-6xl font-bold"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
              >
                +{points}
              </motion.span>
              <span className="text-xl font-semibold mt-1">POINTS!</span>
            </div>
          </motion.div>
          
          {/* Confetti particles */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 rounded-full"
              style={{
                background: ['#fbbf24', '#f97316', '#a855f7', '#3b82f6', '#10b981'][i % 5],
              }}
              initial={{ 
                x: 0, 
                y: 0,
                scale: 1
              }}
              animate={{ 
                x: (Math.random() - 0.5) * 400,
                y: (Math.random() - 0.5) * 400,
                scale: 0,
                opacity: 0
              }}
              transition={{ 
                duration: 1,
                delay: i * 0.05,
                ease: "easeOut"
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}