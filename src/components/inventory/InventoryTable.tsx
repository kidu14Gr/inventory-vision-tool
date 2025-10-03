import React from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InventoryItem = {
  item_name?: string;
  price?: number;
  date_of_purchased?: string;
  store_store_name?: string;
  quantity?: number;
  amount?: number;
  Status?: string;
  [key: string]: any;
};

interface InventoryTableProps {
  data?: InventoryItem[];
}

export function InventoryTable({ data = [] }: InventoryTableProps) {
  const items = data;

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Date Purchased</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.item_name || "N/A"}</TableCell>
                <TableCell>{item.price ? `${item.price.toLocaleString()} birr` : "N/A"}</TableCell>
                <TableCell>{item.date_of_purchased || "N/A"}</TableCell>
                <TableCell>{item.store_store_name || "N/A"}</TableCell>
                <TableCell>{item.quantity || 0}</TableCell>
                <TableCell>{item.amount ? item.amount.toLocaleString() : 0}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.Status === "Critical" ? "destructive" :
                      item.Status === "Low Stock" ? "secondary" :
                      "default"
                    }
                  >
                    {item.Status || "Unknown"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}