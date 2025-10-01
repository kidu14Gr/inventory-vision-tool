import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain } from "lucide-react";
import { PredictionSummary } from "./PredictionSummary";
import { DemandPrediction } from "./DemandPrediction";
import { SmartStockAnalysis } from "./SmartStockAnalysis";

export function AIPredictions() {
  const [selectedProject, setSelectedProject] = useState("all-projects");
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Inventory Prediction
          </h1>
          <p className="text-muted-foreground">Smart demand forecasting for All Projects</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>


      {/* Demand Prediction */}
      <DemandPrediction selectedProject={selectedProject} />

      {/* Smart Stock Analysis Dashboard */}
      <SmartStockAnalysis selectedProject={selectedProject} />
    </div>
  );
}