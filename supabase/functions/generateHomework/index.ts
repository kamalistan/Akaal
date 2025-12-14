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
    const { assignmentType, template, youtubeVideos, readings } = await req.json();

    const prompt = `Generate a ${assignmentType} assignment based on the following:

${template ? `Template:\n${template}\n\n` : ''}${youtubeVideos?.length > 0 ? `YouTube Videos:\n${youtubeVideos.join('\n')}\n\n` : ''}${readings?.length > 0 ? `Readings:\n${readings.join('\n')}` : ''}

Please create a comprehensive ${assignmentType} that incorporates these materials.`;

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
    const output = openaiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ success: true, output }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
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