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
    const {
      to,
      leadId = null,
      leadName = null,
      userEmail,
      lineNumber = 1,
      sessionId = null,
      mockConfig = null
    } = await req.json();

    if (!to || !userEmail) {
      throw new Error('Missing required parameters: to, userEmail');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const defaultConfig = {
      dialingDuration: 1000,
      ringingDuration: 3000,
      connectionProbability: 0.8,
      voicemailProbability: 0.15,
      noAnswerProbability: 0.05
    };

    const config = { ...defaultConfig, ...mockConfig };

    const mockCallSid = `MOCK${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    if (leadId) {
      await supabase
        .from('active_calls')
        .delete()
        .eq('user_email', userEmail)
        .eq('lead_id', leadId);
    } else {
      await supabase
        .from('active_calls')
        .delete()
        .eq('user_email', userEmail)
        .is('lead_id', null);
    }

    const { data: activeCall, error: insertError } = await supabase
      .from('active_calls')
      .insert({
        user_email: userEmail,
        lead_id: leadId,
        call_sid: mockCallSid,
        line_number: lineNumber,
        status: 'dialing',
        status_source: 'mock',
        started_at: new Date().toISOString(),
        is_mock: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    simulateCallProgression(
      supabase,
      mockCallSid,
      config,
      userEmail,
      leadId
    );

    return new Response(
      JSON.stringify({
        success: true,
        callSid: mockCallSid,
        status: 'dialing',
        to: to,
        lineNumber: lineNumber,
        leadId: leadId,
        leadName: leadName,
        sessionId: sessionId,
        isMock: true,
        message: 'Mock call initiated - simulating realistic call flow'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in mockDialerCall:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to initiate mock call'
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

function simulateCallProgression(
  supabase: any,
  callSid: string,
  config: any,
  userEmail: string,
  leadId: string | null
) {
  setTimeout(async () => {
    try {
      const { data: call } = await supabase
        .from('active_calls')
        .select('*')
        .eq('call_sid', callSid)
        .maybeSingle();

      if (!call || call.status !== 'dialing') {
        console.log('Call was canceled or modified, stopping simulation');
        return;
      }

      await supabase
        .from('active_calls')
        .update({ status: 'ringing' })
        .eq('call_sid', callSid);

      setTimeout(async () => {
        try {
          const { data: call } = await supabase
            .from('active_calls')
            .select('*')
            .eq('call_sid', callSid)
            .maybeSingle();

          if (!call || call.status !== 'ringing') {
            console.log('Call was canceled or modified during ringing');
            return;
          }

          const random = Math.random();
          let finalStatus = 'in-progress';

          if (random < config.noAnswerProbability) {
            finalStatus = 'no-answer';
          } else if (random < (config.noAnswerProbability + config.voicemailProbability)) {
            finalStatus = 'voicemail_detected';
          } else if (random >= config.connectionProbability + config.voicemailProbability) {
            finalStatus = 'busy';
          }

          await supabase
            .from('active_calls')
            .update({
              status: finalStatus,
              ...(finalStatus !== 'in-progress' && { ended_at: new Date().toISOString() })
            })
            .eq('call_sid', callSid);

          console.log(`Mock call ${callSid} transitioned to ${finalStatus}`);
        } catch (error) {
          console.error('Error in ringing transition:', error);
        }
      }, config.ringingDuration);
    } catch (error) {
      console.error('Error in dialing transition:', error);
    }
  }, config.dialingDuration);
}
