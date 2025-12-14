import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Copy, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ReactMarkdown from 'react-markdown';

export default function GenerateHomework() {
  const queryClient = useQueryClient();
  const [assignmentId, setAssignmentId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setAssignmentId(id);
  }, []);

  const { data: assignment } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async () => {
      const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
      return assignments[0];
    },
    enabled: !!assignmentId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Assignment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment', assignmentId]);
      queryClient.invalidateQueries(['assignments']);
    },
  });

  const handleGenerate = async () => {
    if (!assignment) return;
    
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateHomework', {
        assignmentType: assignment.type,
        template: assignment.template,
        youtubeVideos: assignment.youtube_videos,
        readings: assignment.readings,
      });

      if (response.data.success) {
        setGeneratedOutput(response.data.output);
        
        // Save to assignment
        await updateMutation.mutateAsync({
          id: assignment.id,
          data: {
            generated_output: response.data.output,
            status: 'completed'
          }
        });
      }
    } catch (error) {
      console.error('Error generating homework:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedOutput);
  };

  const downloadAsText = () => {
    const blob = new Blob([generatedOutput], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assignment?.title || 'homework'}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  useEffect(() => {
    if (assignment?.generated_output) {
      setGeneratedOutput(assignment.generated_output);
    }
  }, [assignment]);

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <p className="text-slate-500">Loading assignment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-800">{assignment.title}</h1>
            <p className="text-slate-600">
              {assignment.type === 'worksheet' ? 'Worksheet Template' : '500 Word Essay'}
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl shadow-lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate Homework'}
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Resources */}
          <motion.div 
            className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-xl font-bold text-slate-800 mb-4">Resources</h2>
            
            {/* Videos */}
            {assignment.youtube_videos && assignment.youtube_videos.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-slate-700 mb-3">YouTube Videos</h3>
                <div className="space-y-2">
                  {assignment.youtube_videos.map((video, index) => (
                    <a
                      key={index}
                      href={video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <p className="text-sm text-slate-700 truncate">{video}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Readings */}
            {assignment.readings && assignment.readings.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Readings</h3>
                <div className="space-y-2">
                  {assignment.readings.map((reading, index) => (
                    <div
                      key={index}
                      className="p-3 bg-blue-50 rounded-xl"
                    >
                      <p className="text-sm text-slate-700 line-clamp-3">{reading}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Template */}
            {assignment.type === 'worksheet' && assignment.template && (
              <div className="mt-6">
                <h3 className="font-semibold text-slate-700 mb-3">Template</h3>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                    {assignment.template}
                  </pre>
                </div>
              </div>
            )}
          </motion.div>

          {/* Right: Generated Output */}
          <motion.div 
            className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Generated Homework</h2>
              {generatedOutput && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    className="rounded-xl"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={downloadAsText}
                    className="rounded-xl"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {generatedOutput ? (
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{generatedOutput}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-500 mb-2">No homework generated yet</p>
                <p className="text-sm text-slate-400">Click "Generate Homework" to create your assignment</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}