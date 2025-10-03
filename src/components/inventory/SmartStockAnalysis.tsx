import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, BarChart3, AlertTriangle, CheckCircle, Package2, MapPin } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useState } from "react";

interface SmartStockAnalysisProps {
  selectedProject: string;
}

const getProjectInventoryData = (project: string) => {
  const allInventory = [
    {
      item: "Network Cables",
      subcategory: "Cat6 Ethernet",
      amount: 120,
      quantity: 150,
      status: "sufficient",
      location: "Warehouse A",
      price: "$150",
      datePurchased: "2024-01-15",
      storeName: "Tech Supplies Co",
      projects: ["all-projects", "network-expansion", "hq-office"],
      requested: 15,
      consumed: 10,
      returned: 5,
      requestedBy: "John Doe",
      requestDate: "2024-09-15"
    },
    {
      item: "Power Supplies",
      subcategory: "UPS 1500VA",
      amount: 25,
      quantity: 45,
      status: "low",
      location: "Warehouse B",
      price: "$300",
      datePurchased: "2024-02-20",
      storeName: "Power Solutions Ltd",
      projects: ["all-projects", "server-migration", "hq-office"],
      requested: 12,
      consumed: 8,
      returned: 0,
      requestedBy: "Sarah Smith",
      requestDate: "2024-08-01"
    },
    {
      item: "Storage Drives",
      subcategory: "SSD 1TB",
      amount: 3,
      quantity: 8,
      status: "critical",
      location: "Warehouse A",
      price: "$150",
      datePurchased: "2024-03-10",
      storeName: "Storage Depot",
      projects: ["all-projects", "server-migration"],
      requested: 5,
      consumed: 5,
      returned: 0,
      requestedBy: "Mike Johnson",
      requestDate: "2024-07-20"
    },
    {
      item: "Server Memory",
      subcategory: "32GB DDR4",
      amount: 15,
      quantity: 20,
      status: "sufficient",
      location: "Warehouse C",
      price: "$300",
      datePurchased: "2024-04-05",
      storeName: "Memory World",
      projects: ["all-projects", "server-migration"],
      requested: 3,
      consumed: 2,
      returned: 0,
      requestedBy: "Emily Davis",
      requestDate: "2024-09-10"
    },
    {
      item: "Switches",
      subcategory: "24-Port Gigabit",
      amount: 28,
      quantity: 32,
      status: "sufficient",
      location: "Warehouse B",
      price: "$300",
      datePurchased: "2024-05-12",
      storeName: "Network Hub Inc",
      projects: ["all-projects", "network-expansion"],
      requested: 4,
      consumed: 4,
      returned: 0,
      requestedBy: "Robert Brown",
      requestDate: "2024-09-20"
    },
    {
      item: "Routers",
      subcategory: "Enterprise WiFi",
      amount: 2,
      quantity: 5,
      status: "critical",
      location: "Warehouse A",
      price: "$500",
      datePurchased: "2024-06-18",
      storeName: "Router Supplies Co",
      projects: ["all-projects", "network-expansion", "hq-office"],
      requested: 3,
      consumed: 3,
      returned: 0,
      requestedBy: "Linda Wilson",
      requestDate: "2024-07-10"
    }
  ];

  if (project === "all-projects") {
    return allInventory;
  }
  
  return allInventory.filter(item => item.projects.includes(project));
};

export function SmartStockAnalysis({ selectedProject }: SmartStockAnalysisProps) {
  const [viewType, setViewType] = useState<"amount" | "quantity">("amount");
  const [inventoryProject, setInventoryProject] = useState(selectedProject);
  const [analyticsProject, setAnalyticsProject] = useState(selectedProject);
  
  const stockAnalysisData = getProjectInventoryData(inventoryProject);
  const analyticsData = getProjectInventoryData(analyticsProject);
  
  const getCurrentStock = (item: any) => viewType === "amount" ? item.amount : item.quantity;
  
  const criticalCount = stockAnalysisData.filter(item => item.status === "critical").length;
  const lowStockCount = stockAnalysisData.filter(item => item.status === "low").length;
  const sufficientCount = stockAnalysisData.filter(item => item.status === "sufficient").length;
  const totalValue = stockAnalysisData.reduce((sum, item) => {
    const price = parseInt(item.price.replace(/[$,]/g, ""));
    return sum + (price * item.quantity);
  }, 0);

  const totalRequested = analyticsData.reduce((sum, item) => sum + item.requested, 0);
  const totalConsumed = analyticsData.reduce((sum, item) => sum + item.consumed, 0);
  const totalReturned = analyticsData.reduce((sum, item) => sum + item.returned, 0);

  const pieChartData = [
    { name: "Requested", value: totalRequested, color: "#3b82f6" },
    { name: "Consumed", value: totalConsumed, color: "#ef4444" },
    { name: "Returned", value: totalReturned, color: "#10b981" }
  ];

  // Get overdue items (requested but not returned/consumed for long time)
  const overdueItems = analyticsData.filter(item => {
    const daysSinceRequest = Math.floor((new Date().getTime() - new Date(item.requestDate).getTime()) / (1000 * 60 * 60 * 24));
    return item.requested > (item.consumed + item.returned) && daysSinceRequest > 30;
  });

  const projectOptions = [
    { value: "all-projects", label: "All Projects" },
    { value: "network-expansion", label: "Network Expansion" },
    { value: "server-migration", label: "Server Migration" },
    { value: "hq-office", label: "HQ Office" }
  ];

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
                      {projectOptions.map((project) => (
                        <SelectItem key={project.value} value={project.value}>
                          {project.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={viewType} onValueChange={(value: "amount" | "quantity") => setViewType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="bg-company-primary text-company-primary-foreground hover:bg-company-primary/90">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Metrics after project selection */}
              <div className="grid grid-cols-4 gap-3">
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
                <div className="p-3 rounded-lg border-l-4 border-l-company-primary bg-gradient-to-br from-company-primary/5 to-company-primary/10">
                  <p className="text-2xl font-bold text-company-primary">${totalValue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Value</p>
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
                  {stockAnalysisData.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gradient-to-r hover:from-company-primary/5 hover:to-transparent transition-all duration-200">
                      <td className="p-4">
                        <div>
                          <div className="font-semibold text-sm">{item.item}</div>
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
                           item.status === "low" ? "Low" : "Sufficient"}
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
                  {projectOptions.map((project) => (
                    <SelectItem key={project.value} value={project.value}>
                      {project.label}
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
                      <p className="font-medium">{item.requestedBy}</p>
                      <p className="text-muted-foreground">Project: {item.projects[1] || item.projects[0]}</p>
                      <p className="text-muted-foreground">Item: {item.item}</p>
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