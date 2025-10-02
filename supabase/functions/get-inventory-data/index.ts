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
    const mockInventoryData = [
      {
        item_name: "Cement Bags",
        price: 450,
        date_of_purchased: "2025-09-15",
        store_store_name: "BuildMart",
        quantity: 100,
        amount: 45000,
        project_display: "PROJECT A"
      },
      {
        item_name: "Steel Bars",
        price: 850,
        date_of_purchased: "2025-09-20",
        store_store_name: "MetalSupply Co",
        quantity: 5,
        amount: 4250,
        project_display: "PROJECT A"
      },
      {
        item_name: "Paint Buckets",
        price: 320,
        date_of_purchased: "2025-09-25",
        store_store_name: "ColorWorld",
        quantity: 25,
        amount: 8000,
        project_display: "PROJECT B"
      },
      {
        item_name: "Electrical Wire",
        price: 180,
        date_of_purchased: "2025-09-28",
        store_store_name: "ElectroMart",
        quantity: 15,
        amount: 2700,
        project_display: "PROJECT B"
      }
    ];

    // Filter by project if specified
    let filteredData = mockInventoryData;
    if (project && project !== "All Projects") {
      filteredData = mockInventoryData.filter(item => item.project_display === project);
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
