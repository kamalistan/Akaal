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
      userEmail,
      sessionId,
      leads, // Array of 3 leads to call
      enableAMD = true,
      amdSensitivity = 'medium',
      enableRecording,
    } = await req.json();

    if (!userEmail || !leads || leads.length === 0) {
      throw new Error('userEmail and leads are required');
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioNumber = Deno.env.get('TWILIO_NUMBER');

    if (!accountSid || !authToken || !twilioNumber) {
      throw new Error('Twilio not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check recording setting
    let shouldRecord = enableRecording;
    if (shouldRecord === undefined) {
      const { data: settings } = await supabase
        .from('dialer_settings')
        .select('enable_call_recording')
        .eq('user_email', userEmail)
        .maybeSingle();

      shouldRecord = settings?.enable_call_recording || false;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const callbackUrl = `${supabaseUrl}/functions/v1/twilioCallStatus`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const initiatedCalls = [];
    const errors = [];

    // Initiate calls to up to 3 leads simultaneously
    for (let i = 0; i < Math.min(leads.length, 3); i++) {
      const lead = leads[i];
      const lineNumber = i + 1;

      try {
        const formData = new URLSearchParams();
        formData.append('To', lead.phone);
        formData.append('From', twilioNumber);
        formData.append('Url', `${callbackUrl}/twiml?leadName=${encodeURIComponent(lead.name || 'contact')}&sessionId=${sessionId || ''}&lineNumber=${lineNumber}&leadId=${lead.id || ''}&userEmail=${encodeURIComponent(userEmail)}`);
        formData.append('StatusCallback', callbackUrl);
        formData.append('StatusCallbackEvent', 'initiated,ringing,answered,completed');
        formData.append('StatusCallbackMethod', 'POST');

        // Enable AMD for all lines
        if (enableAMD) {
          formData.append('MachineDetection', 'DetectMessageEnd');
          const amdTimeout = amdSensitivity === 'low' ? '3000' : amdSensitivity === 'high' ? '7000' : '5000';
          formData.append('MachineDetectionTimeout', amdTimeout);
          formData.append('MachineDetectionSpeechThreshold', '2500');
          formData.append('MachineDetectionSpeechEndThreshold', '1500');
          formData.append('AsyncAmd', 'true'); // Get AMD results asynchronously
          formData.append('AsyncAmdStatusCallback', `${supabaseUrl}/functions/v1/twilioAMDCallback`);
          formData.append('AsyncAmdStatusCallbackMethod', 'POST');
        }

        if (shouldRecord) {
          formData.append('Record', 'record-from-answer');
          formData.append('RecordingStatusCallback', `${supabaseUrl}/functions/v1/twilioRecordingCallback`);
          formData.append('RecordingStatusCallbackEvent', 'completed');
          formData.append('RecordingStatusCallbackMethod', 'POST');
        }

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          errors.push({ lineNumber, leadId: lead.id, error: errorText });
          continue;
        }

        const callData = await response.json();

        // Insert into twilio_call_logs
        await supabase
          .from('twilio_call_logs')
          .insert({
            call_sid: callData.sid,
            lead_id: lead.id,
            to_number: lead.phone,
            from_number: twilioNumber,
            status: callData.status,
          });

        // Insert into active_calls
        await supabase
          .from('active_calls')
          .delete()
          .eq('user_email', userEmail)
          .eq('line_number', lineNumber);

        await supabase
          .from('active_calls')
          .insert({
            user_email: userEmail,
            lead_id: lead.id,
            call_sid: callData.sid,
            line_number: lineNumber,
            status: 'initiating',
            status_source: 'system',
            started_at: new Date().toISOString(),
          });

        initiatedCalls.push({
          lineNumber,
          leadId: lead.id,
          leadName: lead.name,
          phone: lead.phone,
          callSid: callData.sid,
          status: callData.status,
        });

        console.log(`[tripleLineDialer] Line ${lineNumber} initiated:`, {
          callSid: callData.sid,
          leadId: lead.id,
        });

      } catch (error) {
        console.error(`[tripleLineDialer] Error on line ${lineNumber}:`, error);
        errors.push({ lineNumber, leadId: lead.id, error: error.message });
      }
    }

    if (initiatedCalls.length === 0) {
      throw new Error('Failed to initiate any calls');
    }

    console.log('[tripleLineDialer] Triple-line dial initiated:', {
      totalCalls: initiatedCalls.length,
      userEmail,
      sessionId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        calls: initiatedCalls,
        errors: errors.length > 0 ? errors : undefined,
        amdEnabled: enableAMD,
        recordingEnabled: shouldRecord,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('[tripleLineDialer] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to initiate calls'
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