import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_name, item_name, requested_date, in_use } = await req.json();
    
    const ML_API_URL = Deno.env.get('ML_API_URL');
    if (!ML_API_URL) {
      throw new Error('ML_API_URL not configured');
    }

    console.log('Calling ML API with:', { project_name, item_name, requested_date, in_use });

    const response = await fetch(`${ML_API_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_name,
        item_name,
        requested_date,
        in_use: in_use || 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ML API error:', response.status, errorText);
      throw new Error(`ML API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('ML API response:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in predict-demand:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
