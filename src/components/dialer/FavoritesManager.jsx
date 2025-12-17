import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getContactInitials, formatPhoneNumber } from '@/utils/phoneUtils';

export default function FavoritesManager({ userEmail = 'demo@example.com', favorites = [] }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    company: '',
    email: '',
    notes: '',
    speed_dial_slot: null
  });

  const queryClient = useQueryClient();

  const createFavoriteMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('dialer_favorites')
        .insert({ ...data, user_email: userEmail });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dialerFavorites']);
      toast.success('Favorite added successfully');
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add favorite');
    }
  });

  const updateFavoriteMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('dialer_favorites')
        .update(data)
        .eq('id', id)
        .eq('user_email', userEmail);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dialerFavorites']);
      toast.success('Favorite updated successfully');
      setEditingFavorite(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update favorite');
    }
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('dialer_favorites')
        .delete()
        .eq('id', id)
        .eq('user_email', userEmail);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dialerFavorites']);
      toast.success('Favorite deleted');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete favorite');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      company: '',
      email: '',
      notes: '',
      speed_dial_slot: null
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phone_number) {
      toast.error('Name and phone number are required');
      return;
    }

    if (editingFavorite) {
      updateFavoriteMutation.mutate({ id: editingFavorite.id, data: formData });
    } else {
      createFavoriteMutation.mutate(formData);
    }
  };

  const handleEdit = (favorite) => {
    setEditingFavorite(favorite);
    setFormData({
      name: favorite.name || '',
      phone_number: favorite.phone_number || '',
      company: favorite.company || '',
      email: favorite.email || '',
      notes: favorite.notes || '',
      speed_dial_slot: favorite.speed_dial_slot || null
    });
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingFavorite(null);
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Favorite Contacts</h3>
        <Button
          onClick={() => setShowAddDialog(true)}
          size="sm"
          className="rounded-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Favorite
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {favorites.map((favorite) => (
          <motion.div
            key={favorite.id}
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg transition-all"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {getContactInitials(favorite.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 truncate">{favorite.name}</h4>
                    {favorite.company && (
                      <p className="text-sm text-slate-500 truncate">{favorite.company}</p>
                    )}
                  </div>
                  {favorite.speed_dial_slot && (
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {favorite.speed_dial_slot}
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1 font-mono">
                  {formatPhoneNumber(favorite.phone_number)}
                </p>
                {favorite.email && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{favorite.email}</p>
                )}
                {favorite.call_count > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Called {favorite.call_count} time{favorite.call_count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(favorite)}
                className="flex-1"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteFavoriteMutation.mutate(favorite.id)}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {favorites.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Star className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No favorite contacts yet</p>
          <p className="text-sm mt-1">Add contacts for quick access</p>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingFavorite ? 'Edit Favorite' : 'Add Favorite Contact'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Acme Inc."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="speedDial">Speed Dial Slot (1-9)</Label>
              <Input
                id="speedDial"
                type="number"
                min="1"
                max="9"
                value={formData.speed_dial_slot || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  speed_dial_slot: e.target.value ? parseInt(e.target.value) : null
                })}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createFavoriteMutation.isPending || updateFavoriteMutation.isPending}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingFavorite ? 'Update' : 'Add'} Favorite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
