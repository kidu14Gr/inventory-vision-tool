import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Settings, TrendingUp } from "lucide-react";

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
    lastUpdated: "2 hours ago"
  },
  {
    item: "Power Supplies",
    subcategory: "UPS 1500VA",
    currentStock: 45,
    optimalStock: 60,
    status: "low",
    location: "Warehouse B",
    lastUpdated: "1 hour ago"
  },
  {
    item: "Storage Drives",
    subcategory: "SSD 1TB",
    currentStock: 8,
    optimalStock: 25,
    status: "critical",
    location: "Warehouse A",
    lastUpdated: "30 min ago"
  },
  {
    item: "Server Memory",
    subcategory: "32GB DDR4",
    currentStock: 20,
    optimalStock: 15,
    status: "sufficient",
    location: "Warehouse C",
    lastUpdated: "4 hours ago"
  }
];

export function SmartStockAnalysis({ selectedProject }: SmartStockAnalysisProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "low":
        return "bg-warning/10 text-warning border-warning/20";
      case "sufficient":
        return "bg-success/10 text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "critical":
        return "Critical";
      case "low":
        return "Low Stock";
      case "sufficient":
        return "Sufficient";
      default:
        return "Unknown";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          Smart Stock Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search items..." 
              className="pl-10"
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

        {/* Analysis Results */}
        <div className="space-y-3">
          {stockAnalysisData.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
              <div className="flex-1">
                <div className="font-medium text-sm">{item.item}</div>
                <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.location} • Updated {item.lastUpdated}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {item.currentStock} / {item.optimalStock}
                  </div>
                  <div className="text-xs text-muted-foreground">Current / Optimal</div>
                </div>
                <Badge className={getStatusColor(item.status)}>
                  {getStatusText(item.status)}
                </Badge>
                {item.status !== "sufficient" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}