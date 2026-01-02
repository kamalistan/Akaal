import React from 'react';
import { motion } from 'framer-motion';
import { Phone, BarChart3, Trophy, Zap, Settings, Users, PhoneCall } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const tabs = [
  { name: 'Dialer', icon: Phone, page: 'Home' },
  { name: 'Triple Line', icon: PhoneCall, page: 'TripleLineDialing' },
  { name: 'Leads', icon: Users, page: 'Leads' },
  { name: 'Metrics', icon: BarChart3, page: 'Metrics' },
  { name: 'Achievements', icon: Trophy, page: 'Achievements' },
  { name: 'Leaderboard', icon: Zap, page: 'Leaderboard' },
  { name: 'Settings', icon: Settings, page: 'Settings' },
];

export default function TabNav() {
  const location = useLocation();
  
  const getActivePage = () => {
    const path = location.pathname.split('/').pop();
    return path || 'Home';
  };
  
  const activePage = getActivePage();

  return (
    <div className="flex gap-2 bg-[#2d1f4a]/50 p-2 rounded-2xl backdrop-blur-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activePage === tab.page || (tab.page === 'Home' && activePage === '');
        
        return (
          <Link
            key={tab.name}
            to={createPageUrl(tab.page)}
            className="relative flex-1"
          >
            <motion.div
              className={`
                px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all
                ${isActive 
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30' 
                  : 'text-purple-200 hover:bg-purple-900/30'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium text-sm">{tab.name}</span>
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}