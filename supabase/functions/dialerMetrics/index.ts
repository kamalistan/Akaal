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

    // GET /session/:sessionId - Session-specific metrics
    if (req.method === 'GET' && path !== 'today' && path !== 'summary') {
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      // Get all call attempts for this session
      const { data: attempts } = await supabase
        .from('session_lead_attempts')
        .select(`
          *,
          dialer_call_history!inner(
            duration,
            outcome,
            answered_at
          )
        `)
        .eq('session_id', sessionId);

      const totalCalls = attempts?.length || 0;
      const connected = attempts?.filter((a: any) => 
        a.dialer_call_history?.outcome === 'connected'
      ).length || 0;
      const voicemails = attempts?.filter((a: any) => 
        a.dialer_call_history?.outcome === 'voicemail'
      ).length || 0;
      const noAnswers = attempts?.filter((a: any) => 
        a.dialer_call_history?.outcome === 'no-answer'
      ).length || 0;
      const busy = attempts?.filter((a: any) => 
        a.dialer_call_history?.outcome === 'busy'
      ).length || 0;

      const pickups = connected + voicemails;
      const totalTalkTime = attempts?.reduce((sum: number, a: any) => 
        sum + (a.dialer_call_history?.duration || 0), 0
      ) || 0;
      const avgCallDuration = totalCalls > 0 ? Math.round(totalTalkTime / totalCalls) : 0;
      const successRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;
      const contactRate = totalCalls > 0 ? Math.round((pickups / totalCalls) * 100) : 0;

      const metrics = {
        sessionId,
        totalCalls,
        connected,
        voicemails,
        noAnswers,
        busy,
        pickups,
        totalTalkTime,
        avgCallDuration,
        successRate,
        contactRate,
      };

      return new Response(
        JSON.stringify({ success: true, metrics }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /today - Today's metrics for user
    if (req.method === 'GET' && path === 'today') {
      const userEmail = url.searchParams.get('userEmail');

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // Query all calls from today
      const { data: calls } = await supabase
        .from('dialer_call_history')
        .select('*')
        .eq('user_email', userEmail)
        .gte('started_at', todayStr);

      const totalCalls = calls?.length || 0;
      const connected = calls?.filter(c => c.outcome === 'connected').length || 0;
      const voicemails = calls?.filter(c => c.outcome === 'voicemail').length || 0;
      const noAnswers = calls?.filter(c => c.outcome === 'no-answer').length || 0;
      const callbacks = calls?.filter(c => c.outcome === 'callback').length || 0;

      const pickups = connected + voicemails;
      const totalTalkTime = calls?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0;
      const answeredCalls = calls?.filter(c => c.answered_at !== null) || [];
      const avgTalkTime = answeredCalls.length > 0 
        ? Math.round(answeredCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / answeredCalls.length)
        : 0;
      const successRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;
      const contactRate = totalCalls > 0 ? Math.round((pickups / totalCalls) * 100) : 0;

      const metrics = {
        period: 'today',
        totalCalls,
        connected,
        voicemails,
        noAnswers,
        callbacks,
        pickups,
        totalTalkTime,
        avgTalkTime,
        successRate,
        contactRate,
      };

      return new Response(
        JSON.stringify({ success: true, metrics }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /summary - Overall summary for user
    if (req.method === 'GET' && path === 'summary') {
      const userEmail = url.searchParams.get('userEmail');
      const days = parseInt(url.searchParams.get('days') || '30');

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();

      // Query all calls in period
      const { data: calls } = await supabase
        .from('dialer_call_history')
        .select('*')
        .eq('user_email', userEmail)
        .gte('started_at', startDateStr);

      const totalCalls = calls?.length || 0;
      const connected = calls?.filter(c => c.outcome === 'connected').length || 0;
      const voicemails = calls?.filter(c => c.outcome === 'voicemail').length || 0;
      const noAnswers = calls?.filter(c => c.outcome === 'no-answer').length || 0;
      const callbacks = calls?.filter(c => c.outcome === 'callback').length || 0;

      const pickups = connected + voicemails;
      const totalTalkTime = calls?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0;
      const answeredCalls = calls?.filter(c => c.answered_at !== null) || [];
      const avgTalkTime = answeredCalls.length > 0 
        ? Math.round(answeredCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / answeredCalls.length)
        : 0;
      const successRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;
      const contactRate = totalCalls > 0 ? Math.round((pickups / totalCalls) * 100) : 0;

      // Calculate daily average
      const avgCallsPerDay = Math.round(totalCalls / days);

      // Get longest call
      const longestCall = calls?.reduce((max, c) => 
        (c.duration || 0) > max ? (c.duration || 0) : max, 0
      ) || 0;

      // Outcome distribution
      const outcomeDistribution: Record<string, number> = {};
      calls?.forEach(c => {
        if (c.outcome) {
          outcomeDistribution[c.outcome] = (outcomeDistribution[c.outcome] || 0) + 1;
        }
      });

      const metrics = {
        period: `last_${days}_days`,
        totalCalls,
        connected,
        voicemails,
        noAnswers,
        callbacks,
        pickups,
        totalTalkTime,
        avgTalkTime,
        avgCallsPerDay,
        longestCall,
        successRate,
        contactRate,
        outcomeDistribution,
      };

      return new Response(
        JSON.stringify({ success: true, metrics }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in dialerMetrics:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});