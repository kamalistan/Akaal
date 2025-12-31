import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { userEmail } = await req.json();

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    // Safe env check - never logs actual values
    const envCheck = {
      accountSid: !!accountSid,
      apiKeySid: !!apiKeySid,
      apiKeySecret: !!apiKeySecret,
      twimlAppSid: !!twimlAppSid,
    };

    console.log('[twilioGenerateToken] Environment check:', JSON.stringify(envCheck));

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      console.error('[twilioGenerateToken] Missing required variables:', {
        accountSid: !accountSid,
        apiKeySid: !apiKeySid,
        apiKeySecret: !apiKeySecret,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Twilio not configured. Enable Demo Mode in Settings to test without Twilio.',
          needsSetup: true,
          debug: envCheck,
          missingVars: {
            accountSid: !accountSid,
            apiKeySid: !apiKeySid,
            apiKeySecret: !apiKeySecret,
            twimlAppSid: !twimlAppSid,
          }
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

    if (!twimlAppSid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'TWILIO_TWIML_APP_SID not configured. Create a TwiML App in Twilio Console and add its SID.',
          needsSetup: true,
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

    const identity = userEmail || 'demo@example.com';

    // Import Twilio's official AccessToken and VoiceGrant
    const { default: AccessToken } = await import('npm:twilio/lib/jwt/AccessToken.js');
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create Access Token with official SDK
    const token = new AccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      { identity: identity, ttl: 3600 }
    );

    // Create Voice Grant with real TwiML App SID
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    // Add grant to token
    token.addGrant(voiceGrant);

    // Generate JWT string
    const jwtToken = token.toJwt();

    console.log('Generated Twilio token for:', identity);
    console.log('Token details:', {
      accountSid: accountSid,
      apiKeySid: apiKeySid,
      twimlAppSid: twimlAppSid,
      identity: identity,
      hasSecret: !!apiKeySecret,
    });

    return new Response(
      JSON.stringify({
        success: true,
        token: jwtToken,
        identity: identity,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error generating Twilio token:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate token'
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