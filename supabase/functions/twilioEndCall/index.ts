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
    const { callSid, sessionId, userEmail } = await req.json();

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const auth = btoa(`${accountSid}:${authToken}`);

    if (callSid) {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'Status=completed',
        }
      );

      if (!response.ok) {
        console.error('Failed to end call:', callSid);
      }

      await supabase
        .from('active_calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid);
    }

    if (userEmail) {
      const { data: activeCalls } = await supabase
        .from('active_calls')
        .select('call_sid')
        .eq('user_email', userEmail)
        .in('status', ['initiating', 'queued', 'ringing', 'in-progress']);

      if (activeCalls && activeCalls.length > 0) {
        console.log('Terminating all active lines for user:', userEmail);

        for (const call of activeCalls) {
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${call.call_sid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'Status=completed',
            }
          );

          await supabase
            .from('active_calls')
            .update({
              status: 'terminated_by_user',
              ended_at: new Date().toISOString(),
            })
            .eq('call_sid', call.call_sid);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All calls terminated',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in twilioEndCall:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to end call'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});