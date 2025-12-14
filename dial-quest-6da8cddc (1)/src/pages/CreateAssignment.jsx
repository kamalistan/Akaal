import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from "@/components/ui/badge";

export default function CreateAssignment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: '',
    type: 'worksheet',
    template: '',
    youtube_videos: [],
    readings: [],
    due_date: '',
  });

  const [newVideo, setNewVideo] = useState('');
  const [newReading, setNewReading] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Assignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignments']);
      navigate(createPageUrl('MusicHomework'));
    },
  });

  const addVideo = () => {
    if (newVideo.trim()) {
      setFormData({
        ...formData,
        youtube_videos: [...formData.youtube_videos, newVideo.trim()]
      });
      setNewVideo('');
    }
  };

  const removeVideo = (index) => {
    setFormData({
      ...formData,
      youtube_videos: formData.youtube_videos.filter((_, i) => i !== index)
    });
  };

  const addReading = () => {
    if (newReading.trim()) {
      setFormData({
        ...formData,
        readings: [...formData.readings, newReading.trim()]
      });
      setNewReading('');
    }
  };

  const removeReading = (index) => {
    setFormData({
      ...formData,
      readings: formData.readings.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          className="flex items-center gap-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link to={createPageUrl('MusicHomework')}>
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Create Assignment</h1>
            <p className="text-slate-600">Add a new music homework assignment</p>
          </div>
        </motion.div>

        {/* Form */}
        <motion.form 
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Assignment Title
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Week 3: Jazz History"
                className="h-12 rounded-xl"
                required
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Assignment Type
              </label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={formData.type === 'worksheet' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, type: 'worksheet' })}
                  className="flex-1 rounded-xl"
                >
                  Worksheet Template
                </Button>
                <Button
                  type="button"
                  variant={formData.type === 'essay' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, type: 'essay' })}
                  className="flex-1 rounded-xl"
                >
                  500 Word Essay
                </Button>
              </div>
            </div>

            {/* Template (if worksheet) */}
            {formData.type === 'worksheet' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Worksheet Template
                </label>
                <Textarea
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  placeholder="Paste your worksheet template here..."
                  className="min-h-40 rounded-xl"
                />
              </div>
            )}

            {/* YouTube Videos */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                YouTube Videos
              </label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newVideo}
                  onChange={(e) => setNewVideo(e.target.value)}
                  placeholder="Paste YouTube URL"
                  className="rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVideo())}
                />
                <Button type="button" onClick={addVideo} className="rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.youtube_videos.map((video, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                    <span className="flex-1 text-sm text-slate-700 truncate">{video}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVideo(index)}
                      className="rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Readings */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Readings
              </label>
              <div className="flex gap-2 mb-3">
                <Textarea
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder="Paste reading text or URL"
                  className="rounded-xl"
                  rows={3}
                />
                <Button type="button" onClick={addReading} className="rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.readings.map((reading, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl">
                    <span className="flex-1 text-sm text-slate-700">{reading.substring(0, 100)}...</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeReading(index)}
                      className="rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Due Date
              </label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
            </Button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}