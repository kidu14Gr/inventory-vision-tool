import { consumeKafkaTopic } from "./kafkaService";

export interface ProcessedInventoryItem {
  item_name: string;
  subcategory: string;
  amount: number;
  quantity: number;
  status: "sufficient" | "low" | "critical";
  location: string;
  price: string;
  datePurchased: string;
  storeName: string;
  projects: string[];
  requested: number;
  consumed: number;
  returned: number;
  requestedBy: string;
  requestDate: string;
}

export interface ProcessedRequestsItem {
  project_display: string;
  item_name: string;
  requested_quantity: number;
  current_consumed_amount?: number;
  consumed_amount?: number;
  returned_quantity?: number;
  requested_date: string;
  requester_name?: string;
}

export async function getProcessedData(project?: string): Promise<{
  inventoryData: ProcessedInventoryItem[];
  requestsData: ProcessedRequestsItem[];
}> {
  const [inventoryRaw, requestsRaw] = await Promise.all([
  consumeKafkaTopic("scm_inventory", undefined, 5000, "earliest"),
  consumeKafkaTopic("scm_requests", undefined, 5000, "earliest")
  ]);

  // Process inventory data
  const inventoryData: ProcessedInventoryItem[] = inventoryRaw.map((item: any) => {
    const quantity = item.quantity || item.amount || 0;
    let status: "sufficient" | "low" | "critical" = "sufficient";
    if (quantity <= 5) status = "critical";
    else if (quantity <= 20) status = "low";

    return {
      item_name: item.item_name || "Unknown",
      subcategory: item.model || item.serial_number || "",
      amount: item.amount || quantity,
      quantity: quantity,
      status,
      location: item.store_store_name || "Unknown",
  price: `${Number(item.price || 0).toFixed(2)} Birr`,
      datePurchased: item.date_of_purchased || new Date().toISOString().split('T')[0],
      storeName: item.store_store_name || "Unknown",
      projects: [item.project_name || "all-projects"],
      requested: 0, // Will be calculated from requests
      consumed: 0,
      returned: 0,
      requestedBy: "Unknown",
      requestDate: new Date().toISOString().split('T')[0]
    };
  });

  // Process requests data
  const requestsData: ProcessedRequestsItem[] = requestsRaw.map((item: any) => ({
    project_display: item.requested_project_name || item.project_display || "Unknown",
    item_name: item.item_name || "Unknown",
    requested_quantity: item.requested_quantity || 0,
    current_consumed_amount: item.current_consumed_amount || 0,
    consumed_amount: item.consumed_amount || 0,
    returned_quantity: item.returned_quantity || 0,
    requested_date: item.requested_date || new Date().toISOString().split('T')[0],
    requester_name: item.requester_name || "Unknown"
  }));

  // Enrich inventory with request data
  const enrichedInventory = inventoryData.map(inv => {
    const relatedRequests = requestsData.filter(req =>
      req.item_name === inv.item_name
    );

    const totalRequested = relatedRequests.reduce((sum, req) => sum + req.requested_quantity, 0);
    const totalConsumed = relatedRequests.reduce((sum, req) => sum + (req.current_consumed_amount || req.consumed_amount || 0), 0);
    const totalReturned = relatedRequests.reduce((sum, req) => sum + (req.returned_quantity || 0), 0);

    const latestRequest = relatedRequests.sort((a, b) =>
      new Date(b.requested_date).getTime() - new Date(a.requested_date).getTime()
    )[0];

    return {
      ...inv,
      requested: totalRequested,
      consumed: totalConsumed,
      returned: totalReturned,
      requestedBy: latestRequest?.requester_name || inv.requestedBy,
      requestDate: latestRequest?.requested_date || inv.requestDate,
      projects: [...new Set([...inv.projects, ...relatedRequests.map(r => r.project_display)])]
    };
  });

  // Filter by project if specified
  const filteredInventory = project && project !== "all-projects"
    ? enrichedInventory.filter(item => item.projects.includes(project))
    : enrichedInventory;

  return {
    inventoryData: filteredInventory,
    requestsData: project && project !== "all-projects"
      ? requestsData.filter(item => item.project_display === project)
      : requestsData
  };
}