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
    const { pipelineId, locationId } = await req.json();
    const ghlApiKey = Deno.env.get('GHL_API_KEY');

    if (!ghlApiKey) {
      throw new Error('GoHighLevel API key not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const contactsResponse = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
        },
      }
    );

    if (!contactsResponse.ok) {
      throw new Error('Failed to fetch contacts from GoHighLevel');
    }

    const contactsData = await contactsResponse.json();
    const contacts = contactsData.contacts || [];

    let imported = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', contact.phone)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      await supabase
        .from('leads')
        .insert({
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          phone: contact.phone,
          email: contact.email,
          company: contact.companyName,
          status: 'new',
          call_count: 0,
          created_date: new Date().toISOString(),
        });

      imported++;
    }

    return new Response(
      JSON.stringify({ imported, skipped }),
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