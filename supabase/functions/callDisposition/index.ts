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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // POST - Save call disposition
    if (req.method === 'POST') {
      const {
        callSid,
        leadId,
        userEmail,
        phoneNumber,
        contactName,
        outcome,
        notes,
        duration,
        startedAt,
        answeredAt,
        endedAt,
        wasVoicemail,
      } = await req.json();

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      // Validate outcome
      const validOutcomes = [
        'connected',
        'voicemail',
        'no-answer',
        'busy',
        'callback',
        'not-interested',
        'wrong-number',
        'dnc',
        'failed',
      ];

      if (outcome && !validOutcomes.includes(outcome)) {
        throw new Error(`Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`);
      }

      // Insert into dialer_call_history
      const { data: callHistory, error: historyError } = await supabase
        .from('dialer_call_history')
        .insert({
          user_email: userEmail,
          phone_number: phoneNumber,
          contact_name: contactName,
          call_sid: callSid,
          status: endedAt ? 'completed' : 'initiated',
          duration: duration || 0,
          outcome: outcome,
          notes: notes,
          started_at: startedAt || new Date().toISOString(),
          answered_at: answeredAt,
          ended_at: endedAt || new Date().toISOString(),
          lead_id: leadId || null,
          voicemail_left: wasVoicemail || false,
          direction: 'outbound',
        })
        .select()
        .single();

      if (historyError) throw historyError;

      // Update lead if applicable
      if (leadId) {
        const updates: any = {
          last_called_at: new Date().toISOString(),
          last_called_by: userEmail,
        };

        // Update status based on outcome
        if (outcome === 'connected') {
          updates.status = 'contacted';
        } else if (outcome === 'callback') {
          updates.status = 'callback-scheduled';
        } else if (outcome === 'not-interested') {
          updates.status = 'not-interested';
        } else if (outcome === 'dnc') {
          updates.status = 'do-not-call';
          updates.is_dnc = true;
          updates.dnc_reason = notes || 'Requested by lead';
        }

        // Increment call count
        const { data: lead } = await supabase
          .from('leads')
          .select('call_count')
          .eq('id', leadId)
          .single();

        updates.call_count = (lead?.call_count || 0) + 1;

        await supabase
          .from('leads')
          .update(updates)
          .eq('id', leadId);
      }

      // Update user stats if connected
      if (outcome === 'connected') {
        const { data: stats } = await supabase
          .from('user_stats')
          .select('calls_today')
          .eq('user_email', userEmail)
          .maybeSingle();

        if (stats) {
          await supabase
            .from('user_stats')
            .update({
              calls_today: (stats.calls_today || 0) + 1,
            })
            .eq('user_email', userEmail);
        } else {
          await supabase
            .from('user_stats')
            .insert({
              user_email: userEmail,
              calls_today: 1,
            });
        }
      }

      console.log('Call disposition saved:', {
        callSid,
        outcome,
        leadId,
        userEmail,
      });

      return new Response(
        JSON.stringify({
          success: true,
          callHistory: callHistory,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET - Get call dispositions for lead
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const leadId = url.searchParams.get('leadId');
      const userEmail = url.searchParams.get('userEmail');
      const limit = parseInt(url.searchParams.get('limit') || '10');

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      let query = supabase
        .from('dialer_call_history')
        .select('*')
        .eq('user_email', userEmail)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data: history, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, history }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in callDisposition:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});