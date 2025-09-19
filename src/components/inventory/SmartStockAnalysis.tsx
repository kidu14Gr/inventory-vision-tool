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
      amount: 120, // Available in store for requesting
      quantity: 150, // Total company stock (including in use)
      status: "sufficient",
      location: "Warehouse A",
      lastUpdated: "2 hours ago",
      value: "$4,500",
      projects: ["all-projects", "network-expansion", "hq-office"],
      requested: 15,
      consumed: 10,
      returned: 5
    },
    {
      item: "Power Supplies",
      subcategory: "UPS 1500VA",
      amount: 25, // Available in store
      quantity: 45, // Total stock
      status: "low",
      location: "Warehouse B",
      lastUpdated: "1 hour ago",
      value: "$13,500",
      projects: ["all-projects", "server-migration", "hq-office"],
      requested: 12,
      consumed: 8,
      returned: 0
    },
    {
      item: "Storage Drives",
      subcategory: "SSD 1TB",
      amount: 3, // Available in store
      quantity: 8, // Total stock
      status: "critical",
      location: "Warehouse A",
      lastUpdated: "30 min ago",
      value: "$1,200",
      projects: ["all-projects", "server-migration"],
      requested: 5,
      consumed: 5,
      returned: 0
    },
    {
      item: "Server Memory",
      subcategory: "32GB DDR4",
      amount: 15, // Available in store
      quantity: 20, // Total stock
      status: "sufficient",
      location: "Warehouse C",
      lastUpdated: "4 hours ago",
      value: "$6,000",
      projects: ["all-projects", "server-migration"],
      requested: 3,
      consumed: 2,
      returned: 0
    },
    {
      item: "Switches",
      subcategory: "24-Port Gigabit",
      amount: 28, // Available in store
      quantity: 32, // Total stock
      status: "sufficient",
      location: "Warehouse B",
      lastUpdated: "1 hour ago",
      value: "$9,600",
      projects: ["all-projects", "network-expansion"],
      requested: 4,
      consumed: 4,
      returned: 0
    },
    {
      item: "Routers",
      subcategory: "Enterprise WiFi",
      amount: 2, // Available in store
      quantity: 5, // Total stock
      status: "critical",
      location: "Warehouse A",
      lastUpdated: "45 min ago",
      value: "$2,500",
      projects: ["all-projects", "network-expansion", "hq-office"],
      requested: 3,
      consumed: 3,
      returned: 0
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
  
  // Calculate metrics based on selected view type (amount or quantity)
  const getCurrentStock = (item: any) => viewType === "amount" ? item.amount : item.quantity;
  
  const criticalCount = stockAnalysisData.filter(item => item.status === "critical").length;
  const lowStockCount = stockAnalysisData.filter(item => item.status === "low").length;
  const sufficientCount = stockAnalysisData.filter(item => item.status === "sufficient").length;
  const totalValue = stockAnalysisData.reduce((sum, item) => sum + parseInt(item.value.replace(/[$,]/g, "")), 0);

  // Calculate pie chart data from analytics project
  const totalRequested = analyticsData.reduce((sum, item) => sum + item.requested, 0);
  const totalConsumed = analyticsData.reduce((sum, item) => sum + item.consumed, 0);
  const totalReturned = analyticsData.reduce((sum, item) => sum + item.returned, 0);

  const pieChartData = [
    { name: "Requested", value: totalRequested, color: "#3b82f6" },
    { name: "Consumed", value: totalConsumed, color: "#ef4444" },
    { name: "Returned", value: totalReturned, color: "#10b981" }
  ];

  const projectOptions = [
    { value: "all-projects", label: "All Projects" },
    { value: "network-expansion", label: "Network Expansion" },
    { value: "server-migration", label: "Server Migration" },
    { value: "hq-office", label: "HQ Office" }
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-company-primary" />
            Smart Stock Analysis Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">
            {selectedProject === "all-projects" 
              ? "Complete inventory overview across all items and locations"
              : `Inventory analysis for ${selectedProject.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}`
            }
          </p>
        </div>
      </div>

      {/* Enhanced Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-destructive/10 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-destructive">{criticalCount}</p>
                <p className="text-sm text-muted-foreground font-medium">Critical Items</p>
              </div>
              <div className="p-3 rounded-full bg-destructive/20">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-warning/10 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-warning">{lowStockCount}</p>
                <p className="text-sm text-muted-foreground font-medium">Low Stock</p>
              </div>
              <div className="p-3 rounded-full bg-warning/20">
                <Package2 className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success bg-gradient-to-br from-success/5 to-success/10 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-success">{sufficientCount}</p>
                <p className="text-sm text-muted-foreground font-medium">Sufficient</p>
              </div>
              <div className="p-3 rounded-full bg-success/20">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-company-primary bg-gradient-to-br from-company-primary/5 to-company-primary/10 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-company-primary">${totalValue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground font-medium">Total Value</p>
              </div>
              <div className="p-3 rounded-full bg-company-primary/20">
                <BarChart3 className="h-6 w-6 text-company-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Analysis Table & Usage Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enhanced Analysis Table */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-company-primary/5 to-company-primary/10 border-b">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Package2 className="h-5 w-5 text-company-primary" />
                Inventory Analysis
              </CardTitle>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input 
                      placeholder="Search items..." 
                      className="pl-10 sm:w-48 border-company-primary/20 focus:border-company-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={viewType} onValueChange={(value: "amount" | "quantity") => setViewType(value)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">Available Stock</SelectItem>
                        <SelectItem value="quantity">Total Stock</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="hover:bg-company-primary/10">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button size="sm" className="bg-company-primary text-company-primary-foreground hover:bg-company-primary/90">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Item</th>
                    <th className="text-left p-4 font-semibold text-sm">{viewType === "amount" ? "Available" : "Total Stock"}</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-left p-4 font-semibold text-sm">Location</th>
                    <th className="text-left p-4 font-semibold text-sm">Value</th>
                    <th className="text-left p-4 font-semibold text-sm">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAnalysisData.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gradient-to-r hover:from-company-primary/5 hover:to-transparent transition-all duration-200">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-company-primary/10 flex items-center justify-center">
                            <Package2 className="h-5 w-5 text-company-primary" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{item.item}</div>
                            <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-lg font-bold">{getCurrentStock(item)}</div>
                        <div className="text-xs text-muted-foreground">units</div>
                      </td>
                      <td className="p-4">
                        <Badge className={`${
                          item.status === "critical" 
                            ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20" :
                          item.status === "low"
                            ? "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
                            : "bg-success/10 text-success border-success/20 hover:bg-success/20"
                        } transition-colors duration-200`}>
                          {item.status === "critical" ? "🔴 Critical" :
                           item.status === "low" ? "🟡 Low Stock" : "🟢 Sufficient"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{item.location}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-semibold text-company-primary">{item.value}</td>
                      <td className="p-4 text-sm text-muted-foreground">{item.lastUpdated}</td>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}