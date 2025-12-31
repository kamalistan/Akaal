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
    const formData = await req.formData();
    const to = formData.get('To');
    const from = formData.get('From');
    const callSid = formData.get('CallSid');
    const leadId = formData.get('leadId');
    const leadName = formData.get('leadName');
    const userEmail = formData.get('userEmail');
    const sessionId = formData.get('sessionId');

    console.log('[twilioVoiceHandler] Voice handler called:', { to, from, callSid, leadId, userEmail });

    const twilioNumber = Deno.env.get('TWILIO_NUMBER');

    // Safe env check
    console.log('[twilioVoiceHandler] Environment check:', {
      twilioNumber: !!twilioNumber,
    });

    if (!twilioNumber) {
      console.error('[twilioVoiceHandler] TWILIO_NUMBER not configured');
      throw new Error('Twilio number not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const statusCallback = `${supabaseUrl}/functions/v1/twilioCallStatus`;

    if (userEmail && leadId && leadId !== 'null') {
      await supabase
        .from('active_calls')
        .delete()
        .eq('user_email', userEmail)
        .eq('lead_id', leadId);

      await supabase
        .from('active_calls')
        .insert({
          user_email: userEmail,
          lead_id: leadId,
          call_sid: callSid,
          line_number: 1,
          status: 'dialing',
          status_source: 'system',
          started_at: new Date().toISOString(),
          is_mock: false,
        });
    } else if (userEmail) {
      await supabase
        .from('active_calls')
        .delete()
        .eq('user_email', userEmail)
        .is('lead_id', null);

      await supabase
        .from('active_calls')
        .insert({
          user_email: userEmail,
          lead_id: null,
          call_sid: callSid,
          line_number: 1,
          status: 'dialing',
          status_source: 'system',
          started_at: new Date().toISOString(),
          is_mock: false,
        });
    }

    await supabase
      .from('twilio_call_logs')
      .insert({
        call_sid: callSid,
        to_number: to,
        from_number: from || twilioNumber,
        lead_id: leadId && leadId !== 'null' ? leadId : null,
        status: 'initiated',
        created_at: new Date().toISOString(),
      });

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial 
    callerId="${twilioNumber}"
    action="${statusCallback}"
    method="POST"
  >
    <Number statusCallback="${statusCallback}" statusCallbackEvent="initiated,ringing,answered,completed" statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;

    return new Response(twimlResponse, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error in twilioVoiceHandler:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, an error occurred. Please try again.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
});