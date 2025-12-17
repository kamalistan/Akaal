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

    if (url.pathname.includes('/twiml')) {
      const leadName = url.searchParams.get('leadName') || 'contact';
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hello, connecting you with ${leadName}. Please hold.</Say>
  <Dial>
    <Client>browser_client</Client>
  </Dial>
</Response>`;

      return new Response(twimlResponse, {
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    }

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

    const { data: activeCall } = await supabase
      .from('active_calls')
      .select('*, lead_id')
      .eq('call_sid', callSid)
      .maybeSingle();

    if (answeredBy) {
      await supabase
        .from('voicemail_detection_logs')
        .insert({
          call_sid: callSid,
          lead_id: activeCall?.lead_id,
          user_email: activeCall?.user_email || 'demo@example.com',
          amd_result: answeredBy,
          confidence_score: machineDetectionDuration ? parseFloat(machineDetectionDuration) / 100 : null,
          created_at: new Date().toISOString(),
        });

      if (answeredBy === 'machine_end_beep' || answeredBy === 'machine_end_silence' || answeredBy === 'machine_start') {
        console.log('Voicemail detected, terminating call and dialing next lead');

        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

        if (accountSid && authToken) {
          const auth = btoa(`${accountSid}:${authToken}`);
          await fetch(
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
        }

        await supabase
          .from('active_calls')
          .update({
            status: 'voicemail_detected',
            ended_at: new Date().toISOString(),
          })
          .eq('call_sid', callSid);

        return new Response(
          '<Response></Response>',
          {
            headers: {
              'Content-Type': 'application/xml',
            },
          }
        );
      }
    }

    if (callStatus === 'in-progress' && activeCall) {
      const { data: otherLines } = await supabase
        .from('active_calls')
        .select('call_sid')
        .eq('user_email', activeCall.user_email)
        .neq('call_sid', callSid)
        .in('status', ['initiating', 'queued', 'ringing']);

      if (otherLines && otherLines.length > 0) {
        console.log('Call answered, dropping other lines:', otherLines.map(l => l.call_sid));

        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

        if (accountSid && authToken) {
          const auth = btoa(`${accountSid}:${authToken}`);

          for (const line of otherLines) {
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${line.call_sid}.json`,
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
                status: 'dropped_other_answered',
                status_source: 'system',
                ended_at: new Date().toISOString(),
              })
              .eq('call_sid', line.call_sid);
          }
        }
      }

      await supabase
        .from('active_calls')
        .update({
          status: callStatus,
          status_source: 'webhook',
          answered_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid);
    }

    if (callStatus === 'answered' || callStatus === 'ringing' || callStatus === 'queued') {
      await supabase
        .from('active_calls')
        .update({
          status: callStatus,
          status_source: 'webhook',
        })
        .eq('call_sid', callSid);
    }

    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'canceled') {
      await supabase
        .from('active_calls')
        .update({
          status: callStatus,
          status_source: 'webhook',
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