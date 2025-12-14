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
    const callSid = formData.get('CallSid');
    const callStatus = formData.get('CallStatus');
    const callDuration = formData.get('CallDuration');
    const to = formData.get('To');
    const from = formData.get('From');

    console.log('Call Status Update:', {
      callSid,
      callStatus,
      callDuration,
      to,
      from,
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabase
      .from('twilio_call_logs')
      .upsert({
        call_sid: callSid,
        status: callStatus,
        duration: callDuration ? parseInt(callDuration) : 0,
        to_number: to,
        from_number: from,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'call_sid'
      });

    if (error) {
      console.error('Error saving call status:', error);
    }

    return new Response(
      '<Response></Response>',
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  } catch (error) {
    console.error('Error in twilioCallStatus:', error);
    return new Response(
      '<Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  }
});
