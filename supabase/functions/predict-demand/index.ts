import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_name, item_name } = await req.json();

    if (!project_name || !item_name) {
      return new Response(
        JSON.stringify({ error: "Project name and item name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Replace this with actual ML API call
    // const ML_API_URL = "http://your-ml-api:8001";
    // const response = await fetch(`${ML_API_URL}/predict`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     project_name,
    //     item_name,
    //     requested_date: new Date().toISOString().split('T')[0],
    //     in_use: 1
    //   })
    // });
    
    // For now, return a simulated prediction
    const predicted_quantity = Math.floor(Math.random() * 100) + 20;

    return new Response(
      JSON.stringify({ predicted_quantity }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Predict demand error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
