import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Search, Filter, Download } from "lucide-react";

interface PredictionTableProps {
  selectedProject: string;
}

const predictionData = [
  {
    id: 1,
    itemName: "Network Cables",
    category: "Cat6 Ethernet",
    currentStock: 150,
    predictedDemand: 200,
    confidence: 92,
    estimatedApproval: "3-5 days",
    status: "shortage",
    unitPrice: 25.50,
  },
  {
    id: 2,
    itemName: "Power Supplies", 
    category: "UPS 1500VA",
    currentStock: 45,
    predictedDemand: 12,
    confidence: 88,
    estimatedApproval: "1-2 days",
    status: "sufficient",
    unitPrice: 350.00,
  },
  {
    id: 3,
    itemName: "Storage Drives",
    category: "SSD 1TB",
    currentStock: 8,
    predictedDemand: 25,
    confidence: 95,
    estimatedApproval: "5-7 days",
    status: "shortage",
    unitPrice: 120.00,
  },
  {
    id: 4,
    itemName: "Server RAM",
    category: "32GB DDR4",
    currentStock: 20,
    predictedDemand: 18,
    confidence: 87,
    estimatedApproval: "2-3 days",
    status: "near-shortage",
    unitPrice: 280.00,
  },
  {
    id: 5,
    itemName: "Fiber Optic Cables",
    category: "Single Mode 100m",
    currentStock: 75,
    predictedDemand: 30,
    confidence: 90,
    estimatedApproval: "1-2 days",
    status: "sufficient",
    unitPrice: 45.00,
  },
];

export function PredictionTable({ selectedProject }: PredictionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getStatusBadge = (status: string, currentStock: number, predictedDemand: number) => {
    if (status === "shortage") {
      return (
        <div className="flex items-center gap-1">
          <Badge variant="destructive" className="bg-danger text-danger-foreground">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Shortage
          </Badge>
        </div>
      );
    } else if (status === "near-shortage") {
      return (
        <Badge variant="secondary" className="bg-warning text-warning-foreground">
          Near Shortage
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-success text-success-foreground">
          Sufficient
        </Badge>
      );
    }
  };

  const getStockAlert = (currentStock: number, predictedDemand: number) => {
    if (currentStock < predictedDemand) {
      return (
        <div className="text-xs text-danger flex items-center gap-1 mt-1">
          <AlertTriangle className="h-3 w-3" />
          ⚠️ Shortage – reorder may be needed
        </div>
      );
    }
    return null;
  };

  const filteredData = predictionData.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            AI Inventory Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="shortage">Shortage</SelectItem>
              <SelectItem value="near-shortage">Near Shortage</SelectItem>
              <SelectItem value="sufficient">Sufficient</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Item Details</TableHead>
              <TableHead>Store Location</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Predicted Demand</TableHead>
              <TableHead>AI Confidence</TableHead>
              <TableHead>Days Until Reorder</TableHead>
              <TableHead>Unit Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {getStatusBadge(item.status, item.currentStock, item.predictedDemand)}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{item.itemName}</div>
                    <div className="text-sm text-muted-foreground">{item.category}</div>
                    {getStockAlert(item.currentStock, item.predictedDemand)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">Main Store</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{item.currentStock}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{item.predictedDemand}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-muted">
                    {item.confidence}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{item.estimatedApproval}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">${item.unitPrice}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}