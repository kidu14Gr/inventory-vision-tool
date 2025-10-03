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
        topic: "scm_requests",
        group_id: "scm_requests_group",
        auto_offset_reset: "earliest",
        limit: 5000
      })
    });

    if (!kafkaResponse.ok) {
      throw new Error(`Kafka API error: ${kafkaResponse.statusText}`);
    }

    const kafkaData = await kafkaResponse.json();
    const requestsData = kafkaData.messages?.map((msg: any) => msg.value) || [];

    // Filter by project if specified
    let filteredData = requestsData;
    if (project && project !== "All Projects") {
      filteredData = requestsData.filter((item: any) => 
        item.project_display === project || item.requested_project_name === project
      );
    }

    // Calculate analytics
    const totalRequested = filteredData.reduce((sum, item) => sum + item.requested_quantity, 0);
    const totalConsumed = filteredData.reduce((sum, item) => sum + item.current_consumed_amount, 0);
    const totalReturned = filteredData.reduce((sum, item) => sum + item.returned_quantity, 0);

    const analytics = {
      requested: totalRequested,
      consumed: totalConsumed,
      returned: totalReturned
    };

    // Find unreturned items (for alert)
    let alert = null;
    if (project && project !== "All Projects") {
      const unreturnedItems = filteredData.filter(
        item => item.returned_quantity === 0 && item.current_consumed_amount === 0
      );
      
      if (unreturnedItems.length > 0) {
        // Find the oldest unreturned item
        const oldestItem = unreturnedItems.reduce((oldest, current) => {
          const oldestDate = new Date(oldest.requester_received_date || oldest.requested_date);
          const currentDate = new Date(current.requester_received_date || current.requested_date);
          return currentDate < oldestDate ? current : oldest;
        });

        const itemDate = new Date(oldestItem.requester_received_date || oldestItem.requested_date);
        const daysHeld = Math.floor((Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24));

        alert = {
          type: "warning",
          message: `⚠️ Longest unreturned/unconsumed item:\n- ${oldestItem.requester_name} (Project: ${oldestItem.project_display}) requested ${oldestItem.item_name} on ${itemDate.toISOString().split('T')[0]} (${daysHeld} days ago)`
        };
      } else {
        alert = {
          type: "success",
          message: `No unreturned or unconsumed items for project ${project}.`
        };
      }
    } else {
      alert = {
        type: "info",
        message: "Select a specific project to view unreturned items."
      };
    }

    return new Response(
      JSON.stringify({ data: filteredData, analytics, alert }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Get usage data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
