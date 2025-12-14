import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Video, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

const statusColors = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export default function MusicHomework() {
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select()
        .order('due_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['assignments']);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Music Class Homework</h1>
            <p className="text-slate-600">Manage and generate your music assignments</p>
          </div>
          <Link to={createPageUrl('CreateAssignment')}>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30">
              <Plus className="w-5 h-5 mr-2" />
              New Assignment
            </Button>
          </Link>
        </motion.div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((assignment, index) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={createPageUrl(`GenerateHomework?id=${assignment.id}`)}>
                <div className="bg-white rounded-3xl p-6 border border-slate-200 hover:shadow-xl transition-all cursor-pointer h-full">
                  {/* Type badge */}
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={assignment.type === 'worksheet' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                      {assignment.type === 'worksheet' ? (
                        <><FileText className="w-3 h-3 mr-1" /> Worksheet</>
                      ) : (
                        <><BookOpen className="w-3 h-3 mr-1" /> Essay</>
                      )}
                    </Badge>
                    <Badge className={statusColors[assignment.status]}>
                      {assignment.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-800 mb-3">{assignment.title}</h3>

                  {/* Resources count */}
                  <div className="space-y-2 mb-4">
                    {assignment.youtube_videos && assignment.youtube_videos.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Video className="w-4 h-4 text-red-500" />
                        <span>{assignment.youtube_videos.length} videos</span>
                      </div>
                    )}
                    {assignment.readings && assignment.readings.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        <span>{assignment.readings.length} readings</span>
                      </div>
                    )}
                  </div>

                  {/* Due date */}
                  {assignment.due_date && (
                    <p className="text-sm text-slate-500">
                      Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}

          {assignments.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-20">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No assignments yet</p>
              <Link to={createPageUrl('CreateAssignment')}>
                <Button>Create your first assignment</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}