import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, BarChart3, AlertTriangle, CheckCircle, Package2, MapPin } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { ProcessedInventoryItem } from "@/lib/services/dataService";
import { consumeKafkaTopic } from "@/lib/services/kafkaService";
import { generateGeminiResponse } from "@/lib/services/geminiService";

interface SmartStockAnalysisProps {
  selectedProject: string;
}

export function SmartStockAnalysis({ selectedProject }: SmartStockAnalysisProps) {
  const [viewType, setViewType] = useState<"Amount" | "Quantity">("Quantity");
  const [inventoryProject, setInventoryProject] = useState("");
  const [analyticsProject, setAnalyticsProject] = useState(selectedProject || "all-projects");
  const [searchTerm, setSearchTerm] = useState("");
  const [stockAnalysisData, setStockAnalysisData] = useState<ProcessedInventoryItem[]>([]);
  const [analyticsData, setAnalyticsData] = useState<ProcessedInventoryItem[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [inventoryProjectOptions, setInventoryProjectOptions] = useState<string[]>(['all-projects']);
  const [requestsProjectOptions, setRequestsProjectOptions] = useState<string[]>(['all-projects']);
  const [projectOptions, setProjectOptions] = useState<string[]>(['all-projects']);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch raw messages once per topic to avoid duplicated network calls
        const [inventoryRaw, requestsRaw] = await Promise.all([
          consumeKafkaTopic('scm_inventory', undefined, 2000, 'earliest'),
          consumeKafkaTopic('scm_requests', undefined, 2000, 'earliest')
        ]);

        // Process inventory items
        const inventoryData = (inventoryRaw || []).map((item: any) => {
          const quantity = item.quantity || item.amount || 0;
          let status: 'sufficient' | 'low' | 'critical' = 'sufficient';
          if (quantity <= 5) status = 'critical';
          else if (quantity <= 20) status = 'low';

          return {
            item_name: item.item_name || 'Unknown',
            subcategory: item.model || item.serial_number || '',
            amount: item.amount || quantity,
            quantity: quantity,
            status,
            location: item.store_store_name || item.store || 'Unknown',
            price: `${Number(item.price || 0).toFixed(2)} Birr`,
            datePurchased: item.date_of_purchased || new Date().toISOString().split('T')[0],
            storeName: item.store_store_name || item.store || 'Unknown',
            projects: [item.project_name || item.department_id || item.project_display || 'all-projects'],
            requested: 0,
            consumed: 0,
            returned: 0,
            requestedBy: 'Unknown',
            requestDate: new Date().toISOString().split('T')[0]
          } as ProcessedInventoryItem;
        });

        // Process requests
        const requestsData = (requestsRaw || []).map((item: any) => ({
          project_display: item.requested_project_name || item.project_display || item.project_name || '',
          item_name: item.item_name || 'Unknown',
          requested_quantity: item.requested_quantity || 0,
          current_consumed_amount: item.current_consumed_amount || 0,
          consumed_amount: item.consumed_amount || 0,
          returned_quantity: item.returned_quantity || 0,
          requested_date: item.requested_date || new Date().toISOString().split('T')[0],
          requester_name: item.requester_name || 'Unknown'
        }));

        // Enrich inventory with request aggregates
        const enrichedInventory = inventoryData.map(inv => {
          const relatedRequests = requestsData.filter(req => req.item_name === inv.item_name);
          const totalRequested = relatedRequests.reduce((sum, req) => sum + (req.requested_quantity || 0), 0);
          const totalConsumed = relatedRequests.reduce((sum, req) => sum + (req.current_consumed_amount || req.consumed_amount || 0), 0);
          const totalReturned = relatedRequests.reduce((sum, req) => sum + (req.returned_quantity || 0), 0);
          const latestRequest = relatedRequests.sort((a, b) => new Date(b.requested_date).getTime() - new Date(a.requested_date).getTime())[0];

          return {
            ...inv,
            requested: totalRequested,
            consumed: totalConsumed,
            returned: totalReturned,
            requestedBy: latestRequest?.requester_name || inv.requestedBy,
            requestDate: latestRequest?.requested_date || inv.requestDate,
            projects: Array.from(new Set([...(inv.projects || []), ...relatedRequests.map(r => r.project_display)]))
          } as ProcessedInventoryItem;
        });

        // Aggregate inventory by item_name, numeric price, datePurchased, and storeName (sum amount, keep first quantity)
        const aggMap = new Map<string, ProcessedInventoryItem>();
        enrichedInventory.forEach(inv => {
          const priceRaw = Number((inv.price || '').toString().replace(/[^0-9.-]/g, '')) || 0;
          const amountNum = Number(inv.amount || 0) || Number(inv.quantity || 0) || 0;
          const key = `${inv.item_name}||${priceRaw}||${inv.datePurchased}||${inv.storeName}`;
          if (!aggMap.has(key)) {
            // clone and normalize numeric fields
            aggMap.set(key, {
              ...inv,
              amount: amountNum,
              quantity: Number(inv.quantity) || 0,
              price: inv.price,
              // keep projects array
              projects: inv.projects || []
            } as ProcessedInventoryItem);
          } else {
            const existing = aggMap.get(key)!;
            existing.amount = (Number(existing.amount) || 0) + amountNum;
          }
        });

        const aggregatedInventory = Array.from(aggMap.values()).map(it => {
          const statusField = viewType === "Amount" ? Number(it.amount || 0) : Number(it.quantity || 0);
          let status: 'sufficient' | 'low' | 'critical' = 'sufficient';
          if (statusField <= 5) status = 'critical';
          else if (statusField <= 20) status = 'low';
          return { ...it, status } as ProcessedInventoryItem;
        });

        // Derive inventory project options from aggregated inventory projects
        const invProjects = Array.from(new Set(aggregatedInventory.flatMap(i => i.projects || []).filter(Boolean))).sort();
        // Derive requests project options from requests data
        const reqProjects = Array.from(new Set(requestsData.map(r => r.project_display).filter(Boolean))).sort();

        // Set lists
        setInventoryProjectOptions(invProjects.length ? ['all-projects', ...invProjects] : ['all-projects']);
        setRequestsProjectOptions(reqProjects.length ? ['all-projects', ...reqProjects] : ['all-projects']);

        // Save raw requests for usage aggregation
        setRequestsList(requestsData);

        // Set the full aggregated inventory data
        setStockAnalysisData(aggregatedInventory);

        // For analytics (usage), we will compute aggregates directly from requestsList when rendering
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [inventoryProject, analyticsProject]);

  const filteredStockData = useMemo(() => {
    let filtered = stockAnalysisData;
    if (inventoryProject && inventoryProject !== 'all-projects') {
      filtered = stockAnalysisData.filter(i => (i.projects || []).includes(inventoryProject));
    } else if (inventoryProject === 'all-projects') {
      filtered = stockAnalysisData.filter(i => i.status === 'critical' || i.status === 'sufficient');
    } else {
      filtered = [];
    }

    if (searchTerm) {
      filtered = filtered.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return filtered;
  }, [stockAnalysisData, inventoryProject, searchTerm]);

  const getCurrentStock = (item: ProcessedInventoryItem) => viewType === "Amount" ? item.amount : item.quantity;
  
  const criticalCount = filteredStockData.filter(item => item.status === "critical").length;
  const lowStockCount = filteredStockData.filter(item => item.status === "low").length;
  const sufficientCount = filteredStockData.filter(item => item.status === "sufficient").length;
  const totalValue = filteredStockData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Compute usage aggregates from requestsList filtered by analyticsProject (Streamlit uses requests topic for usage)
  const filteredRequests = analyticsProject && analyticsProject !== 'all-projects'
    ? requestsList.filter(r => r.project_display === analyticsProject)
    : requestsList;

  const totalRequested = filteredRequests.reduce((sum, r) => sum + (r.requested_quantity || 0), 0);
  const totalConsumed = filteredRequests.reduce((sum, r) => sum + (r.current_consumed_amount || r.consumed_amount || 0), 0);
  const totalReturned = filteredRequests.reduce((sum, r) => sum + (r.returned_quantity || 0), 0);

  const pieChartData = [
    { name: "Requested", value: totalRequested, color: "#3b82f6" },
    { name: "Consumed", value: totalConsumed, color: "#ef4444" },
    { name: "Returned", value: totalReturned, color: "#10b981" }
  ];

  // Get overdue items (requested but not returned/consumed for long time)
  // Overdue: find requests for which returned and consumed are 0 and older than 30 days, show only the one with longest period
  const allOverdue = filteredRequests.map(r => {
    const returned = r.returned_quantity || 0;
    const consumed = r.current_consumed_amount || r.consumed_amount || 0;
    const date = new Date(r.requested_date || Date.now());
    const daysSinceRequest = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return { ...r, daysSinceRequest, returned, consumed };
  }).filter(r => r.returned === 0 && r.consumed === 0 && r.daysSinceRequest > 30);

  const overdueItems = allOverdue.length > 0 ? [allOverdue.reduce((max, curr) => curr.daysSinceRequest > max.daysSinceRequest ? curr : max)] : [];

  // projectOptions is derived and stored in state via setProjectOptions

  if (loading) {
    return <div className="text-center py-12">Loading stock analysis data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Inventory Analysis Table & Usage Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enhanced Analysis Table */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-company-primary/5 to-company-primary/10 border-b">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Package2 className="h-5 w-5 text-company-primary" />
                  Inventory Analysis
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={inventoryProject} onValueChange={setInventoryProject}>
                      <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryProjectOptions.map((project) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={viewType} onValueChange={(value: "Amount" | "Quantity") => setViewType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Amount">Amount</SelectItem>
                      <SelectItem value="Quantity">Quantity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search Input */}
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>

              {/* Metrics after project selection */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-destructive/10">
                  <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="p-3 rounded-lg border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-warning/10">
                  <p className="text-2xl font-bold text-warning">{lowStockCount}</p>
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                </div>
                <div className="p-3 rounded-lg border-l-4 border-l-success bg-gradient-to-br from-success/5 to-success/10">
                  <p className="text-2xl font-bold text-success">{sufficientCount}</p>
                  <p className="text-xs text-muted-foreground">Sufficient</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Item Name</th>
                    <th className="text-left p-4 font-semibold text-sm">Price</th>
                    <th className="text-left p-4 font-semibold text-sm">Date Purchased</th>
                    <th className="text-left p-4 font-semibold text-sm">Store Name</th>
                    <th className="text-left p-4 font-semibold text-sm">Amount</th>
                    <th className="text-left p-4 font-semibold text-sm">Quantity</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStockData.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gradient-to-r hover:from-company-primary/5 hover:to-transparent transition-all duration-200">
                      <td className="p-4">
                        <div>
                          <div className="font-semibold text-sm">{item.item_name}</div>
                          <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-semibold">{item.price}</td>
                      <td className="p-4 text-sm text-muted-foreground">{item.datePurchased}</td>
                      <td className="p-4 text-sm">{item.storeName}</td>
                      <td className="p-4">
                        <div className="text-sm font-bold">{item.amount}</div>
                        <div className="text-xs text-muted-foreground">available</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold">{item.quantity}</div>
                        <div className="text-xs text-muted-foreground">total</div>
                      </td>
                      <td className="p-4">
                        <Badge className={`${
                          item.status === "critical"
                            ? "bg-destructive/10 text-destructive border-destructive/20" :
                          item.status === "low"
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-success/10 text-success border-success/20"
                        }`}>
                          {item.status === "critical" ? "Critical" :
                           item.status === "low" ? "Low Stock" : "Sufficient"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Usage Analytics Pie Chart */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-company-primary/5 to-company-primary/10 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-company-primary" />
                Usage Analytics
              </CardTitle>
                <Select value={analyticsProject} onValueChange={setAnalyticsProject}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  {requestsProjectOptions.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Requested</span>
                </div>
                <span className="font-semibold">{totalRequested}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Consumed</span>
                </div>
                <span className="font-semibold">{totalConsumed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Returned</span>
                </div>
                <span className="font-semibold">{totalReturned}</span>
              </div>
            </div>

            {/* AI Response */}
            <div className="mt-6">
              {aiLoading && <div className="text-sm text-muted-foreground">Generating AI analysis…</div>}
              {aiResponse && (
                <div className="prose max-w-none p-4 rounded-lg border bg-card">
                  <div dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>') }} />
                </div>
              )}
            </div>

            {/* Overdue Alerts */}
            {overdueItems.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue Items
                </h4>
                {overdueItems.map((item, index) => (
                  <div key={index} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="text-xs">
                      <p className="font-medium">{item.requester_name || item.requestedBy || 'Unknown'}</p>
                      <p className="text-muted-foreground">Project: {item.project_display || item.project_name || 'Unknown'}</p>
                      <p className="text-muted-foreground">Item: {item.item_name}</p>
                      <p className="text-destructive mt-1">Not returned/consumed for 30+ days</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}