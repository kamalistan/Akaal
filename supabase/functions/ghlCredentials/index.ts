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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /status - Check if user has GHL connected
    if (req.method === 'GET' && path === 'status') {
      const userEmail = url.searchParams.get('userEmail');

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      const { data: credentials } = await supabase
        .from('ghl_credentials')
        .select('is_active, last_synced_at, sync_status, sync_error, created_at')
        .eq('user_email', userEmail)
        .maybeSingle();

      const { data: status } = await supabase
        .from('v_user_ghl_status')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          connected: !!credentials && credentials.is_active,
          credentials: credentials,
          status: status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /save - Save or update GHL credentials
    if (req.method === 'POST' && path === 'save') {
      const { userEmail, apiKey, locationId, agencyId } = await req.json();

      if (!userEmail || !apiKey || !locationId) {
        throw new Error('userEmail, apiKey, and locationId are required');
      }

      // Test the connection to GHL API
      const testResponse = await fetch(
        `https://services.leadconnectorhq.com/locations/${locationId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Version': '2021-07-28',
          },
        }
      );

      if (!testResponse.ok) {
        throw new Error('Invalid GHL credentials. Please check your API key and location ID.');
      }

      // Check if credentials already exist
      const { data: existing } = await supabase
        .from('ghl_credentials')
        .select('id')
        .eq('user_email', userEmail)
        .maybeSingle();

      let result;
      if (existing) {
        // Update existing credentials
        const { data, error } = await supabase
          .from('ghl_credentials')
          .update({
            ghl_api_key: apiKey,
            ghl_location_id: locationId,
            agency_id: agencyId || null,
            is_active: true,
            sync_status: 'pending',
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_email', userEmail)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert new credentials
        const { data, error } = await supabase
          .from('ghl_credentials')
          .insert({
            user_email: userEmail,
            ghl_api_key: apiKey,
            ghl_location_id: locationId,
            agency_id: agencyId || null,
            is_active: true,
            sync_status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      console.log('[ghlCredentials] Credentials saved:', {
        userEmail,
        locationId,
        hasAgencyId: !!agencyId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          credentials: result,
          message: 'GHL credentials saved successfully. You can now sync your pipelines and contacts.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /disconnect - Disconnect GHL
    if (req.method === 'POST' && path === 'disconnect') {
      const { userEmail } = await req.json();

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      await supabase
        .from('ghl_credentials')
        .update({ is_active: false })
        .eq('user_email', userEmail);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'GHL disconnected successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete GHL credentials
    if (req.method === 'DELETE') {
      const userEmail = url.searchParams.get('userEmail');

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      await supabase
        .from('ghl_credentials')
        .delete()
        .eq('user_email', userEmail);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'GHL credentials deleted successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ghlCredentials] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});