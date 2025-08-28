import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, BarChart3, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface SmartStockAnalysisProps {
  selectedProject: string;
}

const stockAnalysisData = [
  {
    item: "Network Cables",
    subcategory: "Cat6 Ethernet",
    currentStock: 150,
    optimalStock: 200,
    status: "sufficient",
    location: "Warehouse A",
    lastUpdated: "2 hours ago",
    value: "$4,500"
  },
  {
    item: "Power Supplies",
    subcategory: "UPS 1500VA",
    currentStock: 45,
    optimalStock: 60,
    status: "low",
    location: "Warehouse B",
    lastUpdated: "1 hour ago",
    value: "$13,500"
  },
  {
    item: "Storage Drives",
    subcategory: "SSD 1TB",
    currentStock: 8,
    optimalStock: 25,
    status: "critical",
    location: "Warehouse A",
    lastUpdated: "30 min ago",
    value: "$1,200"
  },
  {
    item: "Server Memory",
    subcategory: "32GB DDR4",
    currentStock: 20,
    optimalStock: 15,
    status: "sufficient",
    location: "Warehouse C",
    lastUpdated: "4 hours ago",
    value: "$6,000"
  },
  {
    item: "Switches",
    subcategory: "24-Port Gigabit",
    currentStock: 32,
    optimalStock: 40,
    status: "sufficient",
    location: "Warehouse B",
    lastUpdated: "1 hour ago",
    value: "$9,600"
  },
  {
    item: "Routers",
    subcategory: "Enterprise WiFi",
    currentStock: 5,
    optimalStock: 15,
    status: "critical",
    location: "Warehouse A",
    lastUpdated: "45 min ago",
    value: "$2,500"
  }
];

export function SmartStockAnalysis({ selectedProject }: SmartStockAnalysisProps) {
  const criticalCount = stockAnalysisData.filter(item => item.status === "critical").length;
  const lowStockCount = stockAnalysisData.filter(item => item.status === "low").length;
  const sufficientCount = stockAnalysisData.filter(item => item.status === "sufficient").length;
  const totalValue = stockAnalysisData.reduce((sum, item) => sum + parseInt(item.value.replace(/[$,]/g, "")), 0);

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Smart Stock Analysis Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">Complete inventory overview across all items and locations</p>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/10">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{lowStockCount}</p>
                <p className="text-xs text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{sufficientCount}</p>
                <p className="text-xs text-muted-foreground">Sufficient</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">${totalValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="text-lg">Inventory Analysis</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="Search items..." 
                  className="pl-10 sm:w-64"
                />
              </div>
              <div className="flex gap-2">
                <Select defaultValue="all-status">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-status">All Status</SelectItem>
                    <SelectItem value="sufficient">Sufficient</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all-stores">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-stores">All Stores</SelectItem>
                    <SelectItem value="warehouse-a">Warehouse A</SelectItem>
                    <SelectItem value="warehouse-b">Warehouse B</SelectItem>
                    <SelectItem value="warehouse-c">Warehouse C</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  More Filters
                </Button>
                <Button variant="outline" size="sm" className="bg-company-primary text-company-primary-foreground hover:bg-company-primary/90">
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
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">Item</th>
                  <th className="text-left p-4 font-medium text-sm">Current/Optimal</th>
                  <th className="text-left p-4 font-medium text-sm">Status</th>
                  <th className="text-left p-4 font-medium text-sm">Location</th>
                  <th className="text-left p-4 font-medium text-sm">Value</th>
                  <th className="text-left p-4 font-medium text-sm">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {stockAnalysisData.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-sm">{item.item}</div>
                        <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <span className="font-medium">{item.currentStock}</span>
                        <span className="text-muted-foreground"> / {item.optimalStock}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div 
                          className={`h-1.5 rounded-full ${
                            item.status === "critical" ? "bg-destructive" :
                            item.status === "low" ? "bg-warning" : "bg-success"
                          }`}
                          style={{ width: `${Math.min((item.currentStock / item.optimalStock) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={
                        item.status === "critical" 
                          ? "bg-destructive/10 text-destructive border-destructive/20" :
                        item.status === "low"
                          ? "bg-warning/10 text-warning border-warning/20"
                          : "bg-success/10 text-success border-success/20"
                      }>
                        {item.status === "critical" ? "Critical" :
                         item.status === "low" ? "Low Stock" : "Sufficient"}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{item.location}</td>
                    <td className="p-4 text-sm font-medium">{item.value}</td>
                    <td className="p-4 text-sm text-muted-foreground">{item.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}