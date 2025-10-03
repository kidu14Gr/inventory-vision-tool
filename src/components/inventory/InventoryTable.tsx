import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const inventoryData = [
  {
    id: 1,
    name: "DELL EMC VMAX STORAGE SERVER",
    model: "DELL EMC",
    serialNumber: "CKM01212206136",
    type: "Project Items",
    store: "Main Store",
    amount: 1,
    unitOfMeasurement: "pcs",
    project: "HQ",
    itemNumber: "NA",
    price: 1,
    totalPrice: 1,
  },
  {
    id: 2,
    name: "Fiber Patch Cable",
    model: "",
    serialNumber: "",
    type: "-",
    store: "Logistics Temp Store",
    amount: 1,
    unitOfMeasurement: "pcs",
    project: "-",
    itemNumber: 1436.4,
    price: 1436.4,
    totalPrice: 1436.4,
  },
  // Add more items as needed
];

export function InventoryTable() {
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
            {inventoryData.map((item) => (
              <TableRow key={item.id}>
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
      </div>
    </div>
  );
}