import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle } from "lucide-react";

interface DemandPredictionProps {
  selectedProject: string;
}

const demandPredictions = [
  {
    category: "Network Cables",
    subcategory: "Cat6 Ethernet",
    predictedAmount: 25,
    currentStock: 150,
    approvalTime: "3-5 days",
    trendType: "increase" as const,
  },
  {
    category: "Power Supplies", 
    subcategory: "UPS 1500VA",
    predictedAmount: 12,
    currentStock: 45,
    approvalTime: "1-2 days",
    trendType: "increase" as const,
  },
  {
    category: "Storage Drives",
    subcategory: "SSD 1TB", 
    predictedAmount: 18,
    currentStock: 8,
    approvalTime: "5-7 days",
    trendType: "increase" as const,
  },
  {
    category: "Server Memory",
    subcategory: "32GB DDR4",
    predictedAmount: 8,
    currentStock: 20,
    approvalTime: "2-3 days",
    trendType: "increase" as const,
  },
];

export function DemandPrediction({ selectedProject }: DemandPredictionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Demand Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {demandPredictions.map((item, index) => {
          const needsReorder = item.currentStock < item.predictedAmount;
          
          return (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1">
                <div className="font-medium text-sm">{item.category}</div>
                <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Approval: {item.approvalTime}
                </div>
                {needsReorder && (
                  <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Reorder needed
                  </div>
                )}
              </div>
              <div className="text-right">
                <Badge 
                  variant="secondary" 
                  className={`${needsReorder ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20'}`}
                >
                  +{item.predictedAmount} units
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  Stock: {item.currentStock}
                </div>
              </div>
            </div>
          );
        })}
        
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