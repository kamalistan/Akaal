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
    const { pipelineId, locationId, stageId, pipelineStageIds } = await req.json();
    const ghlApiKey = Deno.env.get('GHL_API_KEY');

    if (!ghlApiKey) {
      throw new Error('GoHighLevel API key not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: pipelineData } = await supabase
      .from('ghl_pipelines')
      .select('id')
      .eq('ghl_pipeline_id', pipelineId)
      .maybeSingle();

    if (!pipelineData) {
      throw new Error('Pipeline not found in database');
    }

    const syncLogId = crypto.randomUUID();
    await supabase
      .from('ghl_sync_log')
      .insert({
        id: syncLogId,
        sync_type: 'pipeline_import',
        pipeline_id: pipelineData.id,
        status: 'in_progress',
      });

    const searchParams = new URLSearchParams({
      location_id: locationId,
      pipeline_id: pipelineId,
    });

    const stagesToFilter = pipelineStageIds || (stageId ? [stageId] : []);

    if (stagesToFilter && stagesToFilter.length > 0) {
      stagesToFilter.forEach((stage: string) => {
        searchParams.append('pipeline_stage_id', stage);
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

    let imported = 0;
    let updated = 0;
    let skipped = 0;

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

      const contactName = contactData 
        ? `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || contactData.name || 'Unknown'
        : opp.contact?.name || 'Unknown';
      
      const contactPhone = contactData?.phone || opp.contact?.phone || '';
      const contactEmail = contactData?.email || opp.contact?.email || '';
      const companyName = contactData?.companyName || opp.contact?.companyName || '';

      if (!contactPhone && !contactEmail) {
        skipped++;
        continue;
      }

      const { data: existing } = await supabase
        .from('leads')
        .select('id, ghl_opportunity_id')
        .or(`ghl_opportunity_id.eq.${opp.id},phone.eq.${contactPhone}`)
        .maybeSingle();

      const leadData = {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
        company: companyName,
        ghl_contact_id: opp.contact?.id || null,
        ghl_opportunity_id: opp.id,
        pipeline_id: pipelineData.id,
        pipeline_stage_id: opp.pipelineStageId || null,
        opportunity_value: opp.monetaryValue || 0,
        opportunity_status: opp.status || 'open',
        source: opp.source || null,
        tags: contactData?.tags || [],
        assigned_user_id: opp.assignedTo || null,
        custom_fields: contactData?.customField || {},
        notes: opp.notes || null,
        last_synced_at: new Date().toISOString(),
        status: mapOpportunityStatusToLeadStatus(opp.status),
      };

      if (existing) {
        await supabase
          .from('leads')
          .update(leadData)
          .eq('id', existing.id);
        updated++;
      } else {
        await supabase
          .from('leads')
          .insert({
            ...leadData,
            call_count: 0,
          });
        imported++;
      }
    }

    await supabase
      .from('ghl_sync_log')
      .update({
        status: 'completed',
        records_processed: opportunities.length,
        records_imported: imported,
        records_updated: updated,
        records_skipped: skipped,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);

    return new Response(
      JSON.stringify({ imported, updated, skipped, total: opportunities.length }),
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

function mapOpportunityStatusToLeadStatus(oppStatus: string): string {
  switch (oppStatus?.toLowerCase()) {
    case 'won':
      return 'converted';
    case 'lost':
    case 'abandoned':
      return 'lost';
    case 'open':
    default:
      return 'new';
  }
}