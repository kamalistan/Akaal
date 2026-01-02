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
    
    const callSid = formData.get('CallSid') as string;
    const answeredBy = formData.get('AnsweredBy') as string; // 'human', 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax'
    const machineDetectionDuration = formData.get('MachineDetectionDuration') as string;
    const accountSid = formData.get('AccountSid') as string;

    console.log('[twilioAMDCallback] AMD result:', {
      callSid,
      answeredBy,
      machineDetectionDuration,
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the active call info
    const { data: activeCall } = await supabase
      .from('active_calls')
      .select('*')
      .eq('call_sid', callSid)
      .maybeSingle();

    if (!activeCall) {
      console.error('[twilioAMDCallback] No active call found:', callSid);
      return new Response(
        JSON.stringify({ success: false, error: 'Call not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log AMD result
    await supabase
      .from('voicemail_detection_logs')
      .insert({
        call_sid: callSid,
        lead_id: activeCall.lead_id,
        user_email: activeCall.user_email,
        amd_result: answeredBy,
        confidence_score: machineDetectionDuration ? parseFloat(machineDetectionDuration) : null,
      });

    // If HUMAN detected, connect user and hang up other lines
    if (answeredBy === 'human') {
      console.log('[twilioAMDCallback] HUMAN DETECTED on line', activeCall.line_number);

      // Update this call status
      await supabase
        .from('active_calls')
        .update({
          status: 'connected',
          answered_at: new Date().toISOString(),
          status_changed_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid);

      // Get all other active calls for this user
      const { data: otherCalls } = await supabase
        .from('active_calls')
        .select('*')
        .eq('user_email', activeCall.user_email)
        .neq('call_sid', callSid)
        .in('status', ['initiating', 'queued', 'ringing', 'in-progress']);

      if (otherCalls && otherCalls.length > 0) {
        console.log('[twilioAMDCallback] Hanging up other lines:', otherCalls.length);

        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const auth = btoa(`${accountSid}:${authToken}`);

        // Hang up all other calls
        for (const call of otherCalls) {
          try {
            // Update Twilio call to hung up
            const response = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${call.call_sid}.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  Status: 'completed',
                }).toString(),
              }
            );

            if (!response.ok) {
              console.error('[twilioAMDCallback] Failed to hang up call:', call.call_sid);
            }

            // Update active_calls status
            await supabase
              .from('active_calls')
              .update({
                status: 'canceled',
                ended_at: new Date().toISOString(),
                status_changed_at: new Date().toISOString(),
              })
              .eq('call_sid', call.call_sid);

            console.log('[twilioAMDCallback] Hung up line:', call.line_number);

          } catch (error) {
            console.error('[twilioAMDCallback] Error hanging up call:', error);
          }
        }
      }

      // Notify frontend via real-time update (already handled by active_calls update)
      console.log('[twilioAMDCallback] User connected to line:', activeCall.line_number);

    } else {
      // Machine/voicemail detected or other result
      console.log('[twilioAMDCallback] Non-human detected:', answeredBy);

      // Update call status
      await supabase
        .from('active_calls')
        .update({
          status: answeredBy.startsWith('machine') ? 'voicemail_detected' : answeredBy,
          status_changed_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid);

      // Check user settings for what to do with voicemail
      const { data: settings } = await supabase
        .from('dialer_settings')
        .select('amd_action')
        .eq('user_email', activeCall.user_email)
        .maybeSingle();

      const amdAction = settings?.amd_action || 'disconnect';

      if (amdAction === 'disconnect') {
        // Hang up this call
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const auth = btoa(`${accountSid}:${authToken}`);

        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              Status: 'completed',
            }).toString(),
          }
        );

        await supabase
          .from('active_calls')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
          })
          .eq('call_sid', callSid);

        console.log('[twilioAMDCallback] Voicemail auto-disconnected');
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[twilioAMDCallback] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});