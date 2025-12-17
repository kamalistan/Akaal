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
      leadId,
      leadName,
      userEmail,
      lineNumber = 1,
      enableAMD = false,
      amdSensitivity = 'medium',
      enableRecording = false,
      sessionId = null
    } = await req.json();

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioNumber = Deno.env.get('TWILIO_NUMBER');
    const userPhone = Deno.env.get('USER_PHONE');

    if (!accountSid || !authToken || !twilioNumber) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Twilio not configured. Please add your Twilio credentials to enable calling.',
          needsSetup: true
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!to) {
      throw new Error('Phone number is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const callbackUrl = `${supabaseUrl}/functions/v1/twilioCallStatus`;

    const twiml = userPhone
      ? `<Response>
           <Say voice="Polly.Joanna">Connecting you to ${leadName || 'your contact'}. Please wait.</Say>
           <Dial callerId="${twilioNumber}" timeout="30" ${enableRecording ? 'record="record-from-answer" recordingStatusCallback="' + callbackUrl + '/recording"' : ''}>
             <Number>${to}</Number>
           </Dial>
         </Response>`
      : `<Response>
           <Say voice="Polly.Joanna">This is a test call to ${leadName || 'contact'}. Your Twilio is working correctly.</Say>
           <Pause length="2"/>
         </Response>`;

    const formData = new URLSearchParams();
    formData.append('To', userPhone || to);
    formData.append('From', twilioNumber);
    formData.append('Twiml', twiml);
    formData.append('StatusCallback', callbackUrl);
    formData.append('StatusCallbackEvent', 'initiated,ringing,answered,completed');
    formData.append('StatusCallbackMethod', 'POST');

    if (enableAMD) {
      formData.append('MachineDetection', 'DetectMessageEnd');

      const amdTimeout = amdSensitivity === 'low' ? '3000' : amdSensitivity === 'high' ? '7000' : '5000';
      formData.append('MachineDetectionTimeout', amdTimeout);
      formData.append('MachineDetectionSpeechThreshold', '2500');
      formData.append('MachineDetectionSpeechEndThreshold', '1500');
    }

    if (enableRecording) {
      formData.append('Record', 'true');
      formData.append('RecordingStatusCallback', `${callbackUrl}/recording`);
      formData.append('RecordingStatusCallbackEvent', 'completed');
    }

    const auth = btoa(`${accountSid}:${authToken}`);
    
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
      console.error('Twilio API error:', errorText);
      throw new Error(`Failed to initiate call: ${response.status} - ${errorText}`);
    }

    const callData = await response.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase
      .from('twilio_call_logs')
      .insert({
        call_sid: callData.sid,
        lead_id: leadId,
        to_number: to,
        from_number: twilioNumber,
        status: callData.status,
      });

    if (userEmail) {
      await supabase
        .from('active_calls')
        .insert({
          user_email: userEmail,
          lead_id: leadId,
          call_sid: callData.sid,
          line_number: lineNumber,
          status: 'initiating',
          started_at: new Date().toISOString(),
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        callSid: callData.sid,
        status: callData.status,
        to: callData.to,
        from: callData.from,
        lineNumber: lineNumber,
        amdEnabled: enableAMD,
        recordingEnabled: enableRecording,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in twilioInitiateCall:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to initiate call' 
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
