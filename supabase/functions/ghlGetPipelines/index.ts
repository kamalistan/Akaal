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
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const ghlLocationId = Deno.env.get('GHL_LOCATION_ID');

    if (!ghlApiKey || !ghlLocationId) {
      throw new Error('GoHighLevel API key or Location ID not configured');
    }

    const pipelinesResponse = await fetch(
      `https://rest.gohighlevel.com/v1/pipelines/?locationId=${ghlLocationId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
        },
      }
    );

    if (!pipelinesResponse.ok) {
      throw new Error('Failed to fetch pipelines from GoHighLevel');
    }

    const pipelinesData = await pipelinesResponse.json();

    const locationResponse = await fetch(
      `https://rest.gohighlevel.com/v1/locations/${ghlLocationId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
        },
      }
    );

    const locationData = locationResponse.ok ? await locationResponse.json() : null;

    return new Response(
      JSON.stringify({
        pipelines: pipelinesData.pipelines || [],
        locationId: ghlLocationId,
        locationName: locationData?.location?.name || 'Unknown Location',
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