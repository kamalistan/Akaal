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
    
    // Twilio recording callback parameters
    const callSid = formData.get('CallSid') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingDuration = parseInt(formData.get('RecordingDuration') as string || '0');
    const recordingStatus = formData.get('RecordingStatus') as string;
    const accountSid = formData.get('AccountSid') as string;

    console.log('[twilioRecordingCallback] Recording completed:', {
      callSid,
      recordingSid,
      recordingDuration,
      recordingStatus,
    });

    if (!callSid || !recordingSid) {
      throw new Error('Missing required Twilio parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the call in twilio_call_logs or dialer_call_history
    const { data: callLog } = await supabase
      .from('twilio_call_logs')
      .select('*, lead_id')
      .eq('call_sid', callSid)
      .maybeSingle();

    // Also check dialer_call_history for user_email
    const { data: dialerHistory } = await supabase
      .from('dialer_call_history')
      .select('user_email, lead_id')
      .eq('call_sid', callSid)
      .maybeSingle();

    const leadId = callLog?.lead_id || dialerHistory?.lead_id;
    const userEmail = dialerHistory?.user_email || 'demo@example.com';

    // Insert recording into call_recordings table
    const { data: recording, error: recordingError } = await supabase
      .from('call_recordings')
      .insert({
        lead_id: leadId || null,
        user_email: userEmail,
        recording_sid: recordingSid,
        recording_url: recordingUrl,
        duration: recordingDuration,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (recordingError) {
      console.error('[twilioRecordingCallback] Error saving recording:', recordingError);
      throw recordingError;
    }

    // Update call history with recording reference
    if (dialerHistory) {
      await supabase
        .from('dialer_call_history')
        .update({
          notes: `Recording: ${recordingSid}`,
        })
        .eq('call_sid', callSid);
    }

    // Update call_logs if it exists (legacy table)
    const { data: existingCallLog } = await supabase
      .from('call_logs')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCallLog) {
      await supabase
        .from('call_recordings')
        .update({ call_log_id: existingCallLog.id })
        .eq('id', recording.id);

      await supabase
        .from('call_logs')
        .update({ has_recording: true })
        .eq('id', existingCallLog.id);
    }

    console.log('[twilioRecordingCallback] Recording saved successfully:', recording.id);

    return new Response(
      JSON.stringify({ success: true, recording }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[twilioRecordingCallback] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});