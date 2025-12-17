import React from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayCircle, XCircle, Clock, Phone, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function SessionRecoveryModal({ session, onResume, onDiscard, open }) {
  if (!session) return null;

  const progress = session.total_leads > 0
    ? Math.round((session.completed_leads / session.total_leads) * 100)
    : 0;

  const timeAgo = session.last_activity_at
    ? formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })
    : 'Unknown';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDiscard()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-400" />
            Resume Your Session?
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            You have an unfinished dialing session from {timeAgo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800 rounded-lg p-4 space-y-3"
          >
            {session.pipeline && (
              <div className="flex items-center gap-2 text-slate-300">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-sm">Pipeline:</span>
                <span className="font-semibold text-white">{session.pipeline.name}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span className="text-sm">Progress:</span>
              <span className="font-semibold text-white">
                {session.completed_leads} / {session.total_leads} leads
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Completion</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                />
              </div>
            </div>

            {session.current_lead && (
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Next Lead:</p>
                <p className="text-sm font-medium text-white">{session.current_lead.name}</p>
                {session.current_lead.company && (
                  <p className="text-xs text-slate-400">{session.current_lead.company}</p>
                )}
              </div>
            )}
          </motion.div>

          <div className="flex gap-3">
            <Button
              onClick={onResume}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Resume Session
            </Button>

            <Button
              onClick={onDiscard}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Start Fresh
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Resuming will pick up exactly where you left off
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
