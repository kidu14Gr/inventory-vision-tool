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

// We'll fetch/compute predicted demand using the ML API when requested.
const ML_API_URL = (import.meta.env.VITE_ML_API_URL as string) || "http://localhost:8001";

type PredictionItem = {
  id: number | string;
  itemName: string;
  category?: string;
  currentStock?: number;
  predictedDemand?: number | null;
  confidence?: number | null;
  estimatedApproval?: string | null;
  status?: string;
  unitPrice?: number;
};

// Default demo list of items (used only when no data exists); kept small
const defaultItems: PredictionItem[] = [
  { id: 1, itemName: "Network Cables", category: "Cat6 Ethernet", currentStock: 150, unitPrice: 25.5 },
  { id: 2, itemName: "Power Supplies", category: "UPS 1500VA", currentStock: 45, unitPrice: 350 },
  { id: 3, itemName: "Storage Drives", category: "SSD 1TB", currentStock: 8, unitPrice: 120 },
];

export function PredictionTable({ selectedProject }: PredictionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState<PredictionItem[]>(defaultItems);
  const [predictingFor, setPredictingFor] = useState<number | string | null>(null);

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

  const filteredData = items.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.category ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function callPredictionApi(project_name: string, item_name: string) {
    try {
      const payload = {
        project_name,
        item_name,
        requested_date: new Date().toISOString().slice(0, 10),
        in_use: 1,
      };
      const res = await fetch(`${ML_API_URL.replace(/\/+$/, "")}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`ML API error ${res.status}`);
      const body = await res.json();
      // Expecting { predicted_quantity: number }
      return body.predicted_quantity ?? null;
    } catch (e) {
      console.warn("Prediction API failed", e);
      return null;
    }
  }

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
                    {getStatusBadge(item.status ?? "sufficient", item.currentStock ?? 0, item.predictedDemand ?? 0)}
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
                  <div className="font-medium">{item.predictedDemand ?? "—"}</div>
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
                <TableCell>
                  <Button size="sm" onClick={async () => {
                    setPredictingFor(item.id);
                    const predicted = await callPredictionApi(selectedProject || "", item.itemName);
                    setPredictingFor(null);
                    setItems((prev) => prev.map(i => i.id === item.id ? { ...i, predictedDemand: predicted, status: (i.currentStock ?? 0) < (predicted ?? 0) ? 'shortage' : 'sufficient', confidence: predicted ? 85 : null } : i));
                  }} disabled={predictingFor === item.id}>
                    {predictingFor === item.id ? 'Predicting...' : 'Predict'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}