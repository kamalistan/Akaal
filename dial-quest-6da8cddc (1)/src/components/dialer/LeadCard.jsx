import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Building2, DollarSign, Zap } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LeadCard({ lead, onStartCall, xpMultiplier = 1 }) {
  if (!lead) {
    return (
      <motion.div 
        className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-8 border border-purple-500/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center py-12">
          <Phone className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
          <p className="text-purple-300">No leads available</p>
          <p className="text-purple-400 text-sm mt-2">Add leads to start dialing</p>
        </div>
      </motion.div>
    );
  }

  const dealValue = Math.floor(Math.random() * 50000) + 10000;
  const difficulty = ['EASY', 'MEDIUM', 'HARD'][Math.floor(Math.random() * 3)];
  const difficultyColors = {
    EASY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    HARD: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  return (
    <motion.div 
      className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-8 border-2 border-purple-500/30 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
      
      <div className="relative">
        {/* Difficulty badge */}
        <div className="flex justify-end mb-4">
          <Badge className={`${difficultyColors[difficulty]} border font-semibold px-3 py-1`}>
            {difficulty}
          </Badge>
        </div>

        {/* Lead info */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">{lead.name}</h2>
          <div className="flex items-center gap-2 text-purple-300 mb-3">
            <Building2 className="w-4 h-4" />
            <span>{lead.company || 'No company'}</span>
          </div>
          <div className="flex items-center gap-2 text-purple-200">
            <Phone className="w-4 h-4" />
            <span className="font-mono text-lg">{lead.phone}</span>
          </div>
        </div>

        {/* Deal value */}
        <div className="mb-6 bg-purple-900/30 rounded-xl p-4 border border-purple-500/20">
          <div className="text-purple-400 text-sm mb-1">Deal Value:</div>
          <div className="flex items-center gap-2 text-emerald-400 text-2xl font-bold">
            <DollarSign className="w-5 h-5" />
            {dealValue.toLocaleString()}
          </div>
        </div>

        {/* Start call button */}
        <Button
          onClick={onStartCall}
          className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105"
        >
          <Phone className="w-5 h-5 mr-2" />
          Start Call
        </Button>

        {/* XP Multiplier */}
        {xpMultiplier > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-amber-400">
            <Zap className="w-4 h-4 fill-amber-400" />
            <span className="text-sm font-semibold">XP Multiplier: {xpMultiplier}x</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}