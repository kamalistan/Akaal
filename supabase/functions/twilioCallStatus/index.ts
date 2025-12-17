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

    const answeredBy = formData.get('AnsweredBy');
    const machineDetectionDuration = formData.get('MachineDetectionDuration');

    const recordingSid = formData.get('RecordingSid');
    const recordingUrl = formData.get('RecordingUrl');
    const recordingDuration = formData.get('RecordingDuration');

    console.log('Call Status Update:', {
      callSid,
      callStatus,
      callDuration,
      to,
      from,
      answeredBy,
      recordingSid,
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

    if (answeredBy) {
      const { data: callLog } = await supabase
        .from('twilio_call_logs')
        .select('lead_id')
        .eq('call_sid', callSid)
        .maybeSingle();

      await supabase
        .from('voicemail_detection_logs')
        .insert({
          call_sid: callSid,
          lead_id: callLog?.lead_id,
          user_email: 'demo@example.com',
          amd_result: answeredBy,
          confidence_score: machineDetectionDuration ? parseFloat(machineDetectionDuration) / 100 : null,
          created_at: new Date().toISOString(),
        });
    }

    if (callStatus === 'answered' || callStatus === 'in-progress') {
      await supabase
        .from('active_calls')
        .update({
          status: callStatus,
          answered_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid);
    }

    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      await supabase
        .from('active_calls')
        .update({
          status: callStatus,
          ended_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid);
    }

    if (recordingSid && recordingUrl) {
      const { data: callLog } = await supabase
        .from('twilio_call_logs')
        .select('lead_id')
        .eq('call_sid', callSid)
        .maybeSingle();

      await supabase
        .from('call_recordings')
        .insert({
          call_log_id: null,
          lead_id: callLog?.lead_id,
          user_email: 'demo@example.com',
          recording_sid: recordingSid,
          recording_url: recordingUrl,
          duration: recordingDuration ? parseInt(recordingDuration) : 0,
          created_at: new Date().toISOString(),
        });
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
