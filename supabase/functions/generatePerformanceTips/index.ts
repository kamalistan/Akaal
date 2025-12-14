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

    const { data: callLogs } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: leads } = await supabase
      .from('leads')
      .select('*');

    const totalCalls = callLogs?.length || 0;
    const appointments = callLogs?.filter(log => log.outcome === 'appointment_set').length || 0;
    const callbacks = callLogs?.filter(log => log.outcome === 'callback').length || 0;
    const noAnswers = callLogs?.filter(log => log.outcome === 'no_answer').length || 0;
    const successRate = totalCalls > 0 ? Math.round(((appointments + callbacks) / totalCalls) * 100) : 0;
    const contactRate = totalCalls > 0 ? Math.round(((totalCalls - noAnswers) / totalCalls) * 100) : 0;
    const newLeads = leads?.filter(l => l.status === 'new').length || 0;

    let tips = [];

    if (totalCalls === 0) {
      tips = [
        "Start making calls! Your first step to success is taking action. Aim for at least 20 calls today.",
        "Focus on quality conversations. Take time to understand each prospect's needs and pain points.",
        "Set a goal of booking 2-3 appointments today. Consistency is key to building momentum."
      ];
    } else {
      if (successRate < 15) {
        tips.push("Your conversion rate is low. Try asking better qualifying questions early in the call to identify serious prospects.");
      } else if (successRate < 30) {
        tips.push("Good progress! To boost conversions further, practice your closing techniques and handle objections more effectively.");
      } else {
        tips.push("Excellent conversion rate! Keep up the momentum and consider mentoring team members on your techniques.");
      }

      if (contactRate < 50) {
        tips.push("Many calls going unanswered. Try calling at different times - early morning (8-10am) or late afternoon (4-6pm) often work best.");
      }

      if (appointments > 0 && callbacks === 0) {
        tips.push("Great job booking appointments! Don't forget to schedule callbacks with interested prospects who aren't ready to commit yet.");
      }

      if (totalCalls < 20) {
        tips.push("Increase your call volume. Top performers make 50-100 calls per day. Set a goal to make at least 30 calls today.");
      } else if (totalCalls >= 50) {
        tips.push("Outstanding call volume! You're showing great work ethic. Make sure to take breaks and stay energized throughout the day.");
      }

      if (newLeads > 50) {
        const leadsMessage = `You have ${newLeads} fresh leads waiting. Prioritize calling new leads within 5 minutes of receiving them for best results.`;
        tips.push(leadsMessage);
      }

      if (tips.length < 3) {
        tips.push("Review your best calls and identify what made them successful. Replicate those patterns in future conversations.");
      }
    }

    return new Response(
      JSON.stringify({
        tips: tips.slice(0, 4),
        metrics: { 
          successRate,
          totalCalls,
          appointments,
          contactRate
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error generating tips:', error);
    return new Response(
      JSON.stringify({ 
        tips: [
          "Focus on building rapport in the first 30 seconds of your call.",
          "Ask open-ended questions to understand prospect needs better.",
          "Practice active listening and take detailed notes during calls.",
          "Follow up with all prospects within 24 hours of initial contact."
        ],
        metrics: { successRate: 0 },
        error: error.message 
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
