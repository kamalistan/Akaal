import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X } from 'lucide-react';
import PhoneDialer from './PhoneDialer';

export default function DialerFAB({ userEmail = 'demo@example.com', className = '' }) {
  const [showDialer, setShowDialer] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setShowDialer(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full shadow-2xl flex items-center justify-center z-40 hover:shadow-blue-500/50 transition-shadow ${className}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        aria-label="Open phone dialer"
      >
        <Phone className="w-7 h-7 text-white" />
      </motion.button>

      <AnimatePresence>
        {showDialer && (
          <PhoneDialer
            onClose={() => setShowDialer(false)}
            userEmail={userEmail}
          />
        )}
      </AnimatePresence>
    </>
  );
}
