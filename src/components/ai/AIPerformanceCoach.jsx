import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { Sparkles, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AIPerformanceCoach() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: tipsData, isLoading, error, refetch } = useQuery({
    queryKey: ['performanceTips', refreshKey],
    queryFn: async () => {
      return await callEdgeFunction('generatePerformanceTips', {});
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  return (
    <motion.div 
      className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-indigo-500/30"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-white">AI Performance Coach</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-8 text-center"
          >
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
            <p className="text-purple-300 text-sm">Analyzing your performance...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-8 text-center"
          >
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm mb-3">Failed to load performance tips</p>
              <Button
                onClick={handleRefresh}
                size="sm"
                className="bg-red-500 hover:bg-red-600"
              >
                Try Again
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="tips"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {tipsData?.tips?.map((tip, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20"
              >
                <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-purple-300 text-sm leading-relaxed">{tip}</p>
                </div>
              </motion.div>
            ))}

            {tipsData?.metrics && (
              <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-xl mt-4">
                <span className="text-purple-300 text-sm">Overall Performance</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  {tipsData.metrics.successRate}%
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}