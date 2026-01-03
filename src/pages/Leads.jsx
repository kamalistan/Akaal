import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Phone,
  Building2,
  Mail,
  Trash2,
  Upload,
  Download,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import AppHeader from '@/components/navigation/AppHeader';
import TabNav from '@/components/navigation/TabNav';

const statusColors = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  interested: 'bg-purple-100 text-purple-700',
  appointment_set: 'bg-emerald-100 text-emerald-700',
  not_interested: 'bg-slate-100 text-slate-700',
  no_answer: 'bg-orange-100 text-orange-700',
};

export default function Leads() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGHLModal, setShowGHLModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', company: '' });
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [viewingPipelineId, setViewingPipelineId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setCurrentUser({ email: 'demo@example.com' });
  }, []);

  const { data: userStats } = useQuery({
    queryKey: ['userStats', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;

      const { data: stats, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_email', currentUser.email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (!stats) {
        const { data: newStats, error: createError } = await supabase
          .from('user_stats')
          .insert({
            user_email: currentUser.email,
            total_points: 0,
            level: 1,
            calls_today: 0,
            appointments_today: 0,
            current_streak: 0,
            best_streak: 0,
            daily_goal: 50,
            mascot_mood: 'neutral'
          })
          .select()
          .single();

        if (createError) throw createError;
        return newStats;
      }

      return stats;
    },
    enabled: !!currentUser?.email,
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['allLeads', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          pipeline:ghl_pipelines(id, name, stages)
        `)
        .eq('user_email', currentUser.email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.email,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const { data, error } = await supabase
        .from('ghl_pipelines')
        .select('*')
        .eq('user_email', currentUser.email)
        .order('name');

      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },
    enabled: !!currentUser?.email,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('leads')
        .insert({
          ...data,
          status: 'new',
          call_count: 0,
          user_email: currentUser?.email || 'demo@example.com',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allLeads']);
      queryClient.invalidateQueries(['leads']);
      setShowAddModal(false);
      setNewLead({ name: '', phone: '', email: '', company: '' });
    },
    onError: (error) => {
      alert('Failed to add lead: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allLeads']);
      queryClient.invalidateQueries(['leads']);
    },
    onError: (error) => {
      alert('Failed to delete lead: ' + error.message);
    },
  });

  const { data: ghlData, isLoading: ghlLoading, error: ghlError } = useQuery({
    queryKey: ['ghlPipelines', currentUser?.email],
    queryFn: async () => {
      return await callEdgeFunction('ghlGetPipelines', {
        userEmail: currentUser?.email || 'demo@example.com',
      });
    },
    enabled: showGHLModal && !!currentUser?.email,
  });

  const selectedPipelineData = ghlData?.pipelines?.find(p => p.id === selectedPipeline);
  const stagesData = selectedPipelineData ? { stages: selectedPipelineData.stages || [] } : null;

  const handleGHLImport = async () => {
    if (!selectedPipeline || !selectedStage || !ghlData?.locationId) return;

    setIsImporting(true);
    try {
      const response = await callEdgeFunction('ghlImportLeads', {
        userEmail: currentUser?.email || 'demo@example.com',
        pipelineId: selectedPipeline,
        stageId: selectedStage,
        locationId: ghlData.locationId
      });

      queryClient.invalidateQueries(['allLeads']);
      queryClient.invalidateQueries(['leads']);
      setShowGHLModal(false);
      setSelectedPipeline('');
      setSelectedStage('');

      let message = `Import Complete!\n\n`;
      message += `Total Opportunities Found: ${response.total}\n`;
      message += `Pages Fetched: ${response.pages}\n\n`;
      message += `✓ New Leads Imported: ${response.imported}\n`;
      message += `✓ Existing Leads Updated: ${response.updated}\n`;

      if (response.skipped > 0) {
        message += `\n⚠ Skipped: ${response.skipped}\n`;
        if (response.skipReasons) {
          message += `\nSkip Reasons:\n`;
          Object.entries(response.skipReasons).forEach(([reason, count]) => {
            message += `  • ${reason}: ${count}\n`;
          });
        }
      }

      alert(message);
    } catch (error) {
      alert('Failed to import leads: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const addSampleLeads = async () => {
    const sampleLeads = [
      { name: 'John Smith', phone: '+1 (555) 123-4567', email: 'john@techcorp.com', company: 'TechCorp Inc' },
      { name: 'Sarah Johnson', phone: '+1 (555) 234-5678', email: 'sarah@innovate.io', company: 'Innovate.io' },
      { name: 'Michael Brown', phone: '+1 (555) 345-6789', email: 'michael@growthco.com', company: 'GrowthCo' },
      { name: 'Emily Davis', phone: '+1 (555) 456-7890', email: 'emily@scaleup.com', company: 'ScaleUp Solutions' },
      { name: 'David Wilson', phone: '+1 (555) 567-8901', email: 'david@nexgen.com', company: 'NexGen Ventures' },
      { name: 'Lisa Anderson', phone: '+1 (555) 678-9012', email: 'lisa@primeco.com', company: 'Prime Consulting' },
      { name: 'James Taylor', phone: '+1 (555) 789-0123', email: 'james@alphainc.com', company: 'Alpha Industries' },
      { name: 'Jennifer Martinez', phone: '+1 (555) 890-1234', email: 'jennifer@betasoft.com', company: 'BetaSoft' },
    ].map(lead => ({
      ...lead,
      status: 'new',
      call_count: 0,
    }));

    await supabase.from('leads').insert(sampleLeads);
    queryClient.invalidateQueries(['allLeads']);
    queryClient.invalidateQueries(['leads']);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm);

    if (viewingPipelineId) {
      return matchesSearch && lead.pipeline_id === viewingPipelineId;
    }

    return matchesSearch;
  });

  const leadsWithoutPipeline = leads.filter(l => !l.pipeline_id);

  const pipelinesWithLeads = pipelines.map(pipeline => ({
    ...pipeline,
    leadCount: leads.filter(l => l.pipeline_id === pipeline.id).length
  })).filter(p => p.leadCount > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f2e] via-[#2d1f4a] to-[#1a0f2e] relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <AppHeader userStats={userStats} />
        
        <div className="mb-6">
          <TabNav />
        </div>

        {/* Header */}
        <motion.div 
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white">Leads</h1>
            <p className="text-purple-300 mt-1">Manage your sales prospects</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowGHLModal(true)}
              variant="outline"
              className="rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Import from GHL
            </Button>
            <Button
              onClick={addSampleLeads}
              variant="outline"
              className="rounded-xl"
            >
              <Upload className="w-4 h-4 mr-2" />
              Add Sample Leads
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 rounded-2xl border-purple-500/20 bg-[#2d1f4a]/50 backdrop-blur-sm text-white placeholder:text-purple-400"
            />
          </div>
        </motion.div>

        {/* Pipeline Selection or Leads Table */}
        {!viewingPipelineId ? (
          <>
            {/* Pipeline Cards */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {pipelinesWithLeads.map((pipeline, index) => (
                <motion.div
                  key={pipeline.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setViewingPipelineId(pipeline.id)}
                  className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl p-6 border border-purple-500/20 cursor-pointer hover:border-indigo-500/40 transition-all hover:scale-105"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{pipeline.name}</h3>
                        <p className="text-purple-300 text-sm">{pipeline.leadCount} leads</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                    <p className="text-indigo-300 text-sm">Click to view leads in this pipeline</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Leads without Pipeline */}
            {leadsWithoutPipeline.length > 0 && (
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Leads Without Pipeline</h2>
                  <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                    {leadsWithoutPipeline.length} leads
                  </Badge>
                </div>
                <div className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl border border-purple-500/20 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-purple-500/20">
                        <TableHead className="font-semibold text-purple-300">Name</TableHead>
                        <TableHead className="font-semibold text-purple-300">Company</TableHead>
                        <TableHead className="font-semibold text-purple-300">Phone</TableHead>
                        <TableHead className="font-semibold text-purple-300">Status</TableHead>
                        <TableHead className="font-semibold text-purple-300 w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsWithoutPipeline.map((lead) => (
                        <TableRow key={lead.id} className="hover:bg-purple-900/20 transition-colors border-purple-500/20">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                {lead.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <p className="font-medium text-white">{lead.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-purple-200">{lead.company || '-'}</TableCell>
                          <TableCell className="text-purple-200 font-mono">{lead.phone}</TableCell>
                          <TableCell>
                            <Badge className={`${statusColors[lead.status]} capitalize`}>
                              {lead.status?.replace('_', ' ') || 'new'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(lead.id)}
                              className="text-purple-400 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <>
            {/* Back Button */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button
                variant="outline"
                onClick={() => setViewingPipelineId(null)}
                className="rounded-xl text-purple-300 border-purple-500/30"
              >
                ← Back to Pipelines
              </Button>
            </motion.div>

            {/* Table */}
        <motion.div 
          className="bg-[#2d1f4a]/50 backdrop-blur-sm rounded-3xl border border-purple-500/20 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-purple-500/20">
                <TableHead className="font-semibold text-purple-300">Name</TableHead>
                <TableHead className="font-semibold text-purple-300">Company</TableHead>
                <TableHead className="font-semibold text-purple-300">Phone</TableHead>
                <TableHead className="font-semibold text-purple-300">Pipeline</TableHead>
                <TableHead className="font-semibold text-purple-300">Value</TableHead>
                <TableHead className="font-semibold text-purple-300">Status</TableHead>
                <TableHead className="font-semibold text-purple-300">Calls</TableHead>
                <TableHead className="font-semibold text-purple-300 w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredLeads.map((lead, index) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-purple-900/20 transition-colors border-purple-500/20"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {lead.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-white">{lead.name}</p>
                          {lead.email && (
                            <p className="text-sm text-purple-300 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-purple-200">
                        <Building2 className="w-4 h-4" />
                        {lead.company || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-purple-200 font-mono">
                        <Phone className="w-4 h-4" />
                        {lead.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.pipeline?.name ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {lead.pipeline.name}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-purple-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.opportunity_value ? (
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <DollarSign className="w-4 h-4" />
                          {parseFloat(lead.opportunity_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      ) : (
                        <span className="text-purple-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[lead.status]} capitalize`}>
                        {lead.status?.replace('_', ' ') || 'new'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-purple-200">{lead.call_count || 0}</span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(lead.id)}
                        className="text-purple-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>

          {filteredLeads.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <p className="text-purple-300">No leads found. Add some to get started!</p>
            </div>
          )}
        </motion.div>
          </>
        )}
      </div>

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Full Name *"
              value={newLead.name}
              onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
              className="h-12 rounded-xl"
            />
            <Input
              placeholder="Phone Number *"
              value={newLead.phone}
              onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
              className="h-12 rounded-xl"
            />
            <Input
              placeholder="Email"
              type="email"
              value={newLead.email}
              onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
              className="h-12 rounded-xl"
            />
            <Input
              placeholder="Company"
              value={newLead.company}
              onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
              className="h-12 rounded-xl"
            />
            {(!newLead.name || !newLead.phone) && (
              <p className="text-red-500 text-sm">* Name and Phone are required</p>
            )}
            <Button
              onClick={() => createMutation.mutate(newLead)}
              disabled={!newLead.name || !newLead.phone || createMutation.isPending}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Lead'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GoHighLevel Import Modal */}
      <Dialog open={showGHLModal} onOpenChange={setShowGHLModal}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Import from GoHighLevel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {ghlLoading ? (
              <div className="py-8 text-center">
                <p className="text-slate-500">Loading pipelines...</p>
              </div>
            ) : ghlData?.pipelines ? (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Location: {ghlData.locationName}
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Select Pipeline
                  </label>
                  <select
                    value={selectedPipeline}
                    onChange={(e) => {
                      setSelectedPipeline(e.target.value);
                      setSelectedStage('');
                    }}
                    className="w-full h-12 rounded-xl border border-slate-200 px-4 bg-white"
                  >
                    <option value="">Choose a pipeline...</option>
                    {ghlData.pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedPipeline && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Select Stage
                    </label>
                    {stagesData?.stages && stagesData.stages.length > 0 ? (
                      <select
                        value={selectedStage}
                        onChange={(e) => setSelectedStage(e.target.value)}
                        className="w-full h-12 rounded-xl border border-slate-200 px-4 bg-white"
                      >
                        <option value="">Choose a stage...</option>
                        {stagesData.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full h-12 rounded-xl border border-amber-200 px-4 bg-amber-50 flex items-center text-amber-700">
                        No stages found for this pipeline
                      </div>
                    )}
                  </div>
                )}
                <Button
                  onClick={handleGHLImport}
                  disabled={!selectedPipeline || !selectedStage || isImporting}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing All Leads...' : 'Import Leads'}
                </Button>
              </>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-red-500 font-medium">Failed to load pipelines from GoHighLevel</p>
                {ghlError && (
                  <p className="text-sm text-slate-500">
                    {ghlError.message || 'Please check your GHL API credentials'}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}