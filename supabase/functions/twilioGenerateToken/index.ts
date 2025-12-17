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
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Twilio not configured',
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

    const identity = userEmail || 'demo@example.com';
    const ttl = 3600;

    const header = {
      cty: 'twilio-fpa;v=1',
      typ: 'JWT',
      alg: 'HS256'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      jti: `${accountSid}-${now}`,
      iss: accountSid,
      sub: accountSid,
      exp: now + ttl,
      grants: {
        identity: identity,
        voice: {
          outgoing: {
            application_sid: accountSid
          },
          incoming: {
            allow: true
          }
        }
      }
    };

    const base64UrlEncode = (str: string) => {
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = `${encodedHeader}.${encodedPayload}`;

    const secret = authToken;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(message)
    );

    const encodedSignature = base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );

    const token = `${message}.${encodedSignature}`;

    return new Response(
      JSON.stringify({
        success: true,
        token: token,
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