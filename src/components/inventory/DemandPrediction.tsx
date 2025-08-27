import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

const demandPredictions = [
  {
    category: "Network Cables",
    subcategory: "Cat6 Ethernet",
    trend: "+25 units",
    trendType: "increase" as const,
  },
  {
    category: "Power Supplies", 
    subcategory: "UPS 1500VA",
    trend: "+12 units",
    trendType: "increase" as const,
  },
  {
    category: "Storage Drives",
    subcategory: "SSD 1TB", 
    trend: "+18 units",
    trendType: "increase" as const,
  },
  {
    category: "Server Memory",
    subcategory: "32GB DDR4",
    trend: "+8 units",
    trendType: "increase" as const,
  },
];

export function DemandPrediction() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Demand Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {demandPredictions.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex-1">
              <div className="font-medium text-sm">{item.category}</div>
              <div className="text-xs text-muted-foreground">{item.subcategory}</div>
            </div>
            <Badge 
              variant="secondary" 
              className="bg-success/10 text-success border-success/20"
            >
              {item.trend}
            </Badge>
          </div>
        ))}
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-sm font-medium mb-2">Prediction Accuracy</div>
          <div className="text-xs text-muted-foreground mb-2">Based on historical data and project patterns</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background rounded-full h-2">
              <div className="bg-success h-2 rounded-full" style={{ width: "89%" }}></div>
            </div>
            <span className="text-sm font-medium">89%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}