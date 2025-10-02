import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InventoryItem = {
  id?: number | string;
  name?: string;
  model?: string;
  serialNumber?: string;
  type?: string;
  store?: string;
  amount?: number;
  unitOfMeasurement?: string;
  project?: string;
  itemNumber?: number | string;
  price?: number;
  totalPrice?: number;
  [key: string]: any;
};

// Read KAFKA API URL from Vite env (Vite requires VITE_ prefix for client-side envs)
const KAFKA_API_URL = (import.meta.env.VITE_KAFKA_API_URL as string) || "http://localhost:5000";

async function fetchFromKafkaApi(topic: string, groupId = "inventory_frontend", limit = 500) {
  try {
    const payload = {
      topic,
      group_id: groupId,
      limit,
      auto_offset_reset: "earliest",
    };
    const res = await fetch(`${KAFKA_API_URL.replace(/\/+$/, "")}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Kafka API responded ${res.status}`);
    const body = await res.json();
    const msgs = Array.isArray(body?.messages) ? body.messages : [];
    const values: any[] = msgs.map((m: any) => {
      let v = m?.value ?? m;
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
        } catch (_) {
          v = { raw_value: v };
        }
      }
      return v;
    });
    return values;
  } catch (e) {
    console.warn("Failed to fetch from Kafka API", e);
    return null;
  }
}

export function InventoryTable() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      const values = await fetchFromKafkaApi("scm_inventory", "inventory_frontend", 1000);
      if (!mounted) return;
      if (values === null) {
        setError("Could not fetch inventory from Kafka API. Ensure the local Kafka API is running and CORS is enabled.");
        setItems([]);
      } else {
        // Map incoming messages to the InventoryItem shape. We'll attempt to be tolerant of varying shapes.
        const mapped = values.map((v: any, idx: number) => ({
          id: v.id ?? v.item_id ?? `${Date.now()}-${idx}`,
          name: v.item_name ?? v.name ?? v.product ?? (v.raw_value ? String(v.raw_value) : "Unknown Item"),
          model: v.model ?? v.brand ?? "",
          serialNumber: v.serial_number ?? v.serialNumber ?? "",
          type: v.type ?? v.category ?? "-",
          store: v.store_store_name ?? v.store ?? v.location ?? "Main Store",
          amount: Number(v.quantity ?? v.amount ?? v.qty ?? 0),
          unitOfMeasurement: v.unit ?? v.unitOfMeasurement ?? "pcs",
          project: v.project_display ?? v.project ?? v.department_id ?? "-",
          itemNumber: v.item_number ?? v.itemNumber ?? v.itemNumberId ?? "NA",
          price: Number(v.price ?? v.unit_price ?? 0),
          totalPrice: Number(v.total_price ?? v.amount ?? 0),
          ...v,
        }));
        setItems(mapped);
      }
      setLoading(false);
    }

    load();
    // Optionally subscribe/poll periodically in the future
    return () => {
      mounted = false;
    };
  }, []);

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
            7427 Items Count
          </Badge>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-6">Loading inventory from Kafka API...</div>
        ) : error ? (
          <div className="p-6 text-red-500">{error}</div>
        ) : (
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
            {items.map((item) => (
              <TableRow key={String(item.id)}>
                <TableCell>
                  <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">IMG</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.model || "-"}</TableCell>
                <TableCell>{item.serialNumber || "-"}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>{item.store}</TableCell>
                <TableCell>{item.amount}</TableCell>
                <TableCell>{item.unitOfMeasurement}</TableCell>
                <TableCell>{item.project}</TableCell>
                <TableCell>{item.itemNumber === "NA" ? "NA" : item.itemNumber}</TableCell>
                <TableCell>{item.price}</TableCell>
                <TableCell>{item.totalPrice}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}