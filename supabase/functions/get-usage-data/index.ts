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

    // TODO: Replace this with actual data from your database or Kafka
    // This is sample data matching the Streamlit structure
    const mockRequestsData = [
      {
        project_display: "PROJECT A",
        item_name: "Cement Bags",
        requested_quantity: 50,
        current_consumed_amount: 30,
        returned_quantity: 10,
        requester_name: "John Doe",
        requested_date: "2025-09-20",
        requester_received_date: "2025-09-21"
      },
      {
        project_display: "PROJECT A",
        item_name: "Steel Bars",
        requested_quantity: 20,
        current_consumed_amount: 15,
        returned_quantity: 5,
        requester_name: "Jane Smith",
        requested_date: "2025-09-22",
        requester_received_date: "2025-09-23"
      },
      {
        project_display: "PROJECT B",
        item_name: "Paint Buckets",
        requested_quantity: 30,
        current_consumed_amount: 0,
        returned_quantity: 0,
        requester_name: "Mike Johnson",
        requested_date: "2025-08-15",
        requester_received_date: "2025-08-16"
      }
    ];

    // Filter by project if specified
    let filteredData = mockRequestsData;
    if (project && project !== "All Projects") {
      filteredData = mockRequestsData.filter(item => item.project_display === project);
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
