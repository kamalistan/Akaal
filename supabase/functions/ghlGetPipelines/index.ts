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
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const ghlLocationId = Deno.env.get('GHL_LOCATION_ID');

    if (!ghlApiKey || !ghlLocationId) {
      throw new Error('GoHighLevel API key or Location ID not configured. Please add GHL_API_KEY and GHL_LOCATION_ID to your environment variables.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const pipelinesResponse = await fetch(
      `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${ghlLocationId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json',
        },
      }
    );

    if (!pipelinesResponse.ok) {
      const errorText = await pipelinesResponse.text();
      throw new Error(`Failed to fetch pipelines from GoHighLevel: ${pipelinesResponse.status} - ${errorText}`);
    }

    const pipelinesData = await pipelinesResponse.json();
    const pipelines = pipelinesData.pipelines || [];

    for (const pipeline of pipelines) {
      const { data: existing } = await supabase
        .from('ghl_pipelines')
        .select('id')
        .eq('ghl_pipeline_id', pipeline.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('ghl_pipelines')
          .update({
            name: pipeline.name,
            stages: pipeline.stages || [],
            location_id: ghlLocationId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('ghl_pipelines')
          .insert({
            ghl_pipeline_id: pipeline.id,
            name: pipeline.name,
            stages: pipeline.stages || [],
            location_id: ghlLocationId,
            is_active: true,
          });
      }
    }

    return new Response(
      JSON.stringify({
        pipelines: pipelines,
        locationId: ghlLocationId,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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