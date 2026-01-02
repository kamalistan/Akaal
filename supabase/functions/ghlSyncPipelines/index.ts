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
    const { userEmail } = await req.json();

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

    console.log('[ghlSyncPipelines] Starting pipeline sync for:', userEmail);

    // Update sync status
    await supabase
      .from('ghl_credentials')
      .update({ sync_status: 'syncing' })
      .eq('user_email', userEmail);

    // Fetch pipelines from GHL API
    const response = await fetch(
      `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${credentials.ghl_location_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.ghl_api_key}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GHL API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const pipelines = data.pipelines || [];

    console.log('[ghlSyncPipelines] Found pipelines:', pipelines.length);

    let importedCount = 0;
    let updatedCount = 0;

    // Sync each pipeline
    for (const pipeline of pipelines) {
      // Check if pipeline already exists for this user
      const { data: existing } = await supabase
        .from('ghl_pipelines')
        .select('id')
        .eq('ghl_pipeline_id', pipeline.id)
        .eq('user_email', userEmail)
        .maybeSingle();

      const pipelineData = {
        ghl_pipeline_id: pipeline.id,
        name: pipeline.name,
        location_id: credentials.ghl_location_id,
        stages: pipeline.stages || [],
        is_active: true,
        user_email: userEmail,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing pipeline
        await supabase
          .from('ghl_pipelines')
          .update(pipelineData)
          .eq('id', existing.id);
        updatedCount++;
      } else {
        // Insert new pipeline
        await supabase
          .from('ghl_pipelines')
          .insert(pipelineData);
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
        sync_type: 'pipelines',
        status: 'completed',
        records_processed: pipelines.length,
        records_imported: importedCount,
        records_updated: updatedCount,
        completed_at: new Date().toISOString(),
      });

    console.log('[ghlSyncPipelines] Sync completed:', {
      total: pipelines.length,
      imported: importedCount,
      updated: updatedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pipelines synced successfully',
        stats: {
          total: pipelines.length,
          imported: importedCount,
          updated: updatedCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ghlSyncPipelines] Error:', error);

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