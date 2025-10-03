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
    const { project } = await req.json();

    // Fetch data from Kafka API
    const kafkaApiUrl = Deno.env.get("KAFKA_API_URL");
    if (!kafkaApiUrl) {
      throw new Error("KAFKA_API_URL not configured");
    }

    const kafkaResponse = await fetch(`${kafkaApiUrl}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "scm_inventory",
        group_id: "scm_inventory_group",
        auto_offset_reset: "earliest",
        limit: 5000
      })
    });

    if (!kafkaResponse.ok) {
      throw new Error(`Kafka API error: ${kafkaResponse.statusText}`);
    }

    const kafkaData = await kafkaResponse.json();
    const inventoryData = kafkaData.messages?.map((msg: any) => msg.value) || [];

    // Filter by project if specified
    let filteredData = inventoryData;
    if (project && project !== "All Projects") {
      filteredData = inventoryData.filter((item: any) => 
        item.project_display === project || item.department_id === project
      );
    }

    // Calculate status for each item
    const dataWithStatus = filteredData.map(item => {
      let status = "🟢 Sufficient";
      if (item.quantity <= 5) {
        status = "🔴 Critical";
      } else if (item.quantity <= 20) {
        status = "🟡 Low Stock";
      }
      return { ...item, status };
    });

    // Calculate summary
    const summary = {
      critical: dataWithStatus.filter(item => item.status === "🔴 Critical").length,
      lowStock: dataWithStatus.filter(item => item.status === "🟡 Low Stock").length,
      sufficient: dataWithStatus.filter(item => item.status === "🟢 Sufficient").length,
      totalItems: dataWithStatus.length,
      totalValue: dataWithStatus.reduce((sum, item) => sum + item.amount, 0)
    };

    return new Response(
      JSON.stringify({ data: dataWithStatus, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Get inventory data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
