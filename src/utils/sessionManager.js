import { supabase } from '@/lib/supabase';

export class SessionManager {
  constructor(userEmail) {
    this.userEmail = userEmail;
    this.sessionId = null;
    this.autoSaveInterval = null;
    this.localStorageKey = `dialer_session_${userEmail}`;
  }

  async createSession(pipelineId, leads, filterSettings) {
    try {
      const { data, error } = await supabase
        .from('dialer_sessions')
        .insert({
          user_email: this.userEmail,
          pipeline_id: pipelineId,
          current_lead_index: 0,
          current_lead_id: leads[0]?.id || null,
          total_leads: leads.length,
          completed_leads: 0,
          filter_settings: filterSettings || {},
          is_active: true,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      this.sessionId = data.id;
      this.saveToLocalStorage(data);
      this.startAutoSave();

      return data;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async updateSession(updates) {
    if (!this.sessionId) return null;

    try {
      const { data, error } = await supabase
        .from('dialer_sessions')
        .update({
          ...updates,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', this.sessionId)
        .select()
        .single();

      if (error) throw error;

      this.saveToLocalStorage(data);
      return data;
    } catch (error) {
      console.error('Error updating session:', error);

      const localData = this.getFromLocalStorage();
      if (localData) {
        return { ...localData, ...updates };
      }
      return null;
    }
  }

  async endSession() {
    if (!this.sessionId) return;

    this.stopAutoSave();

    try {
      await supabase
        .from('dialer_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', this.sessionId);

      this.clearLocalStorage();
      this.sessionId = null;
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  async getActiveSession() {
    try {
      const { data, error } = await supabase
        .from('dialer_sessions')
        .select(`
          *,
          pipeline:ghl_pipelines(id, name),
          current_lead:leads(id, name, phone, email, company)
        `)
        .eq('user_email', this.userEmail)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        this.sessionId = data.id;
        this.saveToLocalStorage(data);
        return data;
      }

      const localData = this.getFromLocalStorage();
      if (localData && this.isSessionValid(localData)) {
        return localData;
      }

      return null;
    } catch (error) {
      console.error('Error getting active session:', error);

      const localData = this.getFromLocalStorage();
      if (localData && this.isSessionValid(localData)) {
        return localData;
      }
      return null;
    }
  }

  async getSessionLeads(session) {
    try {
      const filterSettings = session.filter_settings || {};

      let query = supabase
        .from('leads')
        .select(`
          *,
          pipeline:ghl_pipelines(id, name)
        `);

      if (session.pipeline_id) {
        query = query.eq('pipeline_id', session.pipeline_id);
      }

      if (filterSettings.status) {
        query = query.eq('status', filterSettings.status);
      }

      if (filterSettings.tags && filterSettings.tags.length > 0) {
        query = query.contains('tags', filterSettings.tags);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting session leads:', error);
      return [];
    }
  }

  startAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      if (this.sessionId) {
        this.updateSession({});
      }
    }, 30000);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  saveToLocalStorage(sessionData) {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify({
        ...sessionData,
        lastSaved: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  getFromLocalStorage() {
    try {
      const data = localStorage.getItem(this.localStorageKey);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  clearLocalStorage() {
    try {
      localStorage.removeItem(this.localStorageKey);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  isSessionValid(session) {
    if (!session || !session.last_activity_at) return false;

    const lastActivity = new Date(session.last_activity_at);
    const now = new Date();
    const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);

    return hoursSinceActivity < 24;
  }

  async getSessionHistory(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('dialer_sessions')
        .select(`
          *,
          pipeline:ghl_pipelines(id, name)
        `)
        .eq('user_email', this.userEmail)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }

  cleanup() {
    this.stopAutoSave();
  }
}

export const createSessionManager = (userEmail) => {
  return new SessionManager(userEmail);
};
