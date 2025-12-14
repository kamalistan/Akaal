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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: callLogs } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: leads } = await supabase
      .from('leads')
      .select('*');

    const totalCalls = callLogs?.length || 0;
    const successfulCalls = callLogs?.filter(log => 
      log.outcome === 'success' || log.outcome === 'appointment_set'
    ).length || 0;
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

    const prompt = `Based on these sales call statistics, provide 3-4 actionable performance tips:
- Total recent calls: ${totalCalls}
- Success rate: ${successRate}%
- Total leads: ${leads?.length || 0}

Provide practical, specific advice for improving sales performance.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResponse.json();
    const tipsText = openaiData.choices[0].message.content;
    const tips = tipsText.split('\n').filter((line: string) => line.trim().length > 0);

    return new Response(
      JSON.stringify({
        tips,
        metrics: { successRate }
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