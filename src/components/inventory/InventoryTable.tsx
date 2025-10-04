import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { consumeKafkaTopic } from "@/lib/services/kafkaService";

interface InventoryItem {
  item_name?: string;
  model?: string;
  serial_number?: string;
  type?: string;
  store_store_name?: string;
  quantity?: number;
  unit_of_measurement?: string;
  project_name?: string;
  item_number?: string;
  price?: number;
  amount?: number;
  date_of_purchased?: string;
}

export function InventoryTable() {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true);
  const data = await consumeKafkaTopic("scm_inventory", undefined, 5000, "earliest");
        setInventoryData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch inventory data");
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading inventory data...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select defaultValue="main-store">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main-store">Store</SelectItem>
              <SelectItem value="temp-store">Temp Store</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="item-group">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="item-group">Item Group</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-company-primary text-company-primary-foreground px-4 py-2">
            {inventoryData.length} Items Count
          </Badge>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Unit of Measurement</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Item Number</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Total Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventoryData.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">IMG</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{item.item_name || "-"}</TableCell>
                <TableCell>{item.model || "-"}</TableCell>
                <TableCell>{item.serial_number || "-"}</TableCell>
                <TableCell>{item.type || "-"}</TableCell>
                <TableCell>{item.store_store_name || "-"}</TableCell>
                <TableCell>{item.amount || item.quantity || 0}</TableCell>
                <TableCell>{item.unit_of_measurement || "pcs"}</TableCell>
                <TableCell>{item.project_name || "-"}</TableCell>
                <TableCell>{item.item_number || "NA"}</TableCell>
                <TableCell>{(Number(item.price) || 0).toFixed(2)} Birr</TableCell>
                <TableCell>{((Number(item.price) || 0) * (Number(item.amount) || Number(item.quantity) || 0)).toFixed(2)} Birr</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}