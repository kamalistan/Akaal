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
    const { userEmail, pipelineId, limit = 100 } = await req.json();

    if (!userEmail) {
      throw new Error('userEmail is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's GHL credentials
    const { data: credentials, error: credError } = await supabase
      .from('ghl_credentials')
      .select('*')
      .eq('user_email', userEmail)
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('No active GHL credentials found. Please connect your GHL account first.');
    }

    // Get pipeline info if provided
    let ghlPipelineId = null;
    if (pipelineId) {
      const { data: pipeline } = await supabase
        .from('ghl_pipelines')
        .select('ghl_pipeline_id')
        .eq('id', pipelineId)
        .eq('user_email', userEmail)
        .maybeSingle();

      ghlPipelineId = pipeline?.ghl_pipeline_id;
    }

    console.log('[ghlSyncContacts] Starting contact sync:', {
      userEmail,
      pipelineId: ghlPipelineId,
    });

    // Update sync status
    await supabase
      .from('ghl_credentials')
      .update({ sync_status: 'syncing' })
      .eq('user_email', userEmail);

    // Fetch opportunities from GHL API
    let apiUrl = `https://services.leadconnectorhq.com/opportunities/search?location_id=${credentials.ghl_location_id}&limit=${limit}`;
    if (ghlPipelineId) {
      apiUrl += `&pipelineId=${ghlPipelineId}`;
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${credentials.ghl_api_key}`,
        'Version': '2021-07-28',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GHL API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const opportunities = data.opportunities || [];

    console.log('[ghlSyncContacts] Found opportunities:', opportunities.length);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Sync each opportunity as a lead
    for (const opp of opportunities) {
      // Skip if no contact info
      if (!opp.contact || !opp.contact.phone) {
        skippedCount++;
        continue;
      }

      // Check if lead already exists
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('ghl_opportunity_id', opp.id)
        .eq('user_email', userEmail)
        .maybeSingle();

      const leadData = {
        name: opp.contact.name || opp.name || 'Unknown',
        phone: opp.contact.phone,
        email: opp.contact.email || null,
        company: opp.contact.companyName || null,
        status: opp.status || 'new',
        ghl_contact_id: opp.contact.id,
        ghl_opportunity_id: opp.id,
        pipeline_id: pipelineId || null,
        pipeline_stage_id: opp.pipelineStageId || null,
        opportunity_value: opp.monetaryValue || null,
        opportunity_status: opp.status || 'open',
        source: 'ghl',
        user_email: userEmail,
        last_synced_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing lead
        await supabase
          .from('leads')
          .update(leadData)
          .eq('id', existing.id);
        updatedCount++;
      } else {
        // Insert new lead
        await supabase
          .from('leads')
          .insert(leadData);
        importedCount++;
      }
    }

    // Update sync status
    await supabase
      .from('ghl_credentials')
      .update({
        sync_status: 'completed',
        last_synced_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('user_email', userEmail);

    // Log sync activity
    await supabase
      .from('ghl_sync_log')
      .insert({
        sync_type: 'opportunities',
        pipeline_id: pipelineId || null,
        status: 'completed',
        records_processed: opportunities.length,
        records_imported: importedCount,
        records_updated: updatedCount,
        records_skipped: skippedCount,
        completed_at: new Date().toISOString(),
      });

    console.log('[ghlSyncContacts] Sync completed:', {
      total: opportunities.length,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contacts synced successfully',
        stats: {
          total: opportunities.length,
          imported: importedCount,
          updated: updatedCount,
          skipped: skippedCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ghlSyncContacts] Error:', error);

    // Update sync status to failed
    const { userEmail } = await req.json().catch(() => ({}));
    if (userEmail) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase
        .from('ghl_credentials')
        .update({
          sync_status: 'failed',
          sync_error: error.message,
        })
        .eq('user_email', userEmail);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});