import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Target } from 'lucide-react';

export default function QuickInsights({ insights }) {
  const cards = [
    { 
      title: 'Best Day', 
      value: insights.bestDay,
      subtitle: insights.bestDayDetail,
      icon: Calendar,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    { 
      title: 'Peak Hour', 
      value: insights.peakHour,
      subtitle: insights.peakHourDetail,
      icon: Clock,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    { 
      title: 'This Week Goal', 
      value: insights.weekGoal,
      subtitle: insights.weekGoalDetail,
      icon: Target,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            className="bg-[#1a0f2e] rounded-2xl p-6 border border-purple-500/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className={`w-10 h-10 ${card.bgColor} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <h4 className="text-purple-400 text-sm mb-2">{card.title}</h4>
            <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
            {card.subtitle && (
              <p className="text-emerald-400 text-sm">{card.subtitle}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}