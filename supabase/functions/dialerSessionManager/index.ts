import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // GET /active - Get or create active session
    if (req.method === 'GET' && path === 'active') {
      const userEmail = url.searchParams.get('userEmail');
      const pipelineId = url.searchParams.get('pipelineId');

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      // Check for existing active session
      const { data: existingSession } = await supabase
        .from('dialer_sessions')
        .select('*')
        .eq('user_email', userEmail)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        // Update last activity
        await supabase
          .from('dialer_sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', existingSession.id);

        return new Response(
          JSON.stringify({ success: true, session: existingSession }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new session - build query conditionally
      let leadsQuery = supabase
        .from('leads')
        .select('id')
        .eq('user_email', userEmail)
        .eq('is_dnc', false)
        .order('last_called_at', { ascending: true, nullsFirst: true });

      // Only filter by pipeline if one is specified
      if (pipelineId) {
        leadsQuery = leadsQuery.eq('pipeline_id', pipelineId);
      }

      const { data: leads } = await leadsQuery;

      const { data: newSession, error } = await supabase
        .from('dialer_sessions')
        .insert({
          user_email: userEmail,
          pipeline_id: pipelineId || null,
          total_leads: leads?.length || 0,
          current_lead_index: 0,
          completed_leads: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, session: newSession }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /next-lead - Get next undialed lead
    if (req.method === 'POST' && path === 'next-lead') {
      const { sessionId, pipelineId, userEmail } = await req.json();

      if (!sessionId || !userEmail) {
        throw new Error('sessionId and userEmail are required');
      }

      // Use database function to get next lead
      const { data: nextLead } = await supabase
        .rpc('get_next_undialed_lead', {
          p_session_id: sessionId,
          p_pipeline_id: pipelineId || null,
          p_user_email: userEmail,
        })
        .maybeSingle();

      if (!nextLead) {
        // No more leads, end session
        await supabase
          .from('dialer_sessions')
          .update({ 
            is_active: false, 
            ended_at: new Date().toISOString() 
          })
          .eq('id', sessionId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            lead: null, 
            sessionComplete: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update session with current lead
      const { data: session } = await supabase
        .from('dialer_sessions')
        .select('current_lead_index')
        .eq('id', sessionId)
        .single();

      await supabase
        .from('dialer_sessions')
        .update({
          current_lead_id: nextLead.lead_id,
          current_lead_index: (session?.current_lead_index || 0) + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      return new Response(
        JSON.stringify({ success: true, lead: nextLead }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /mark-attempted - Mark lead as attempted
    if (req.method === 'POST' && path === 'mark-attempted') {
      const { sessionId, leadId, outcome, userEmail } = await req.json();

      if (!sessionId || !leadId || !userEmail) {
        throw new Error('sessionId, leadId, and userEmail are required');
      }

      // Insert attempt record
      await supabase
        .from('session_lead_attempts')
        .insert({
          session_id: sessionId,
          lead_id: leadId,
          outcome: outcome || null,
          user_email: userEmail,
        });

      // Update session completed count
      const { data: session } = await supabase
        .from('dialer_sessions')
        .select('completed_leads')
        .eq('id', sessionId)
        .single();

      await supabase
        .from('dialer_sessions')
        .update({
          completed_leads: (session?.completed_leads || 0) + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // Update lead's last_called_at
      await supabase
        .from('leads')
        .update({
          last_called_at: new Date().toISOString(),
          call_count: supabase.rpc('increment', { x: 1 }),
          last_called_by: userEmail,
        })
        .eq('id', leadId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /end-session - End active session
    if (req.method === 'POST' && path === 'end-session') {
      const { sessionId } = await req.json();

      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      await supabase
        .from('dialer_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /progress - Get session progress
    if (req.method === 'GET' && path === 'progress') {
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      const { data: progress } = await supabase
        .from('v_session_progress')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      return new Response(
        JSON.stringify({ success: true, progress }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in dialerSessionManager:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});