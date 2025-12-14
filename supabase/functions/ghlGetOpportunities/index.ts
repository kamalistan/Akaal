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
    const { pipelineId, locationId, pipelineStageIds } = await req.json();
    const ghlApiKey = Deno.env.get('GHL_API_KEY');

    if (!ghlApiKey) {
      throw new Error('GoHighLevel API key not configured');
    }

    const searchParams = new URLSearchParams({
      location_id: locationId,
      pipeline_id: pipelineId,
    });

    if (pipelineStageIds && pipelineStageIds.length > 0) {
      pipelineStageIds.forEach((stageId: string) => {
        searchParams.append('pipeline_stage_id', stageId);
      });
    }

    const opportunitiesResponse = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?${searchParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json',
        },
      }
    );

    if (!opportunitiesResponse.ok) {
      const errorText = await opportunitiesResponse.text();
      throw new Error(`Failed to fetch opportunities: ${opportunitiesResponse.status} - ${errorText}`);
    }

    const opportunitiesData = await opportunitiesResponse.json();
    const opportunities = opportunitiesData.opportunities || [];

    const enrichedOpportunities = [];

    for (const opp of opportunities) {
      let contactData = null;

      if (opp.contact && opp.contact.id) {
        try {
          const contactResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/${opp.contact.id}`,
            {
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Version': '2021-07-28',
                'Accept': 'application/json',
              },
            }
          );

          if (contactResponse.ok) {
            const contactJson = await contactResponse.json();
            contactData = contactJson.contact || null;
          }
        } catch (error) {
          console.error(`Failed to fetch contact ${opp.contact.id}:`, error);
        }
      }

      enrichedOpportunities.push({
        ...opp,
        contactDetails: contactData,
      });
    }

    return new Response(
      JSON.stringify({
        opportunities: enrichedOpportunities,
        total: enrichedOpportunities.length,
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