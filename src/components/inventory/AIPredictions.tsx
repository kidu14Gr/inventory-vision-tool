import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, BarChart3 } from "lucide-react";
import { PredictionSummary } from "./PredictionSummary";
import { PredictionTable } from "./PredictionTable";
import { DemandPrediction } from "./DemandPrediction";

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
          <h1 className="text-2xl font-semibold text-foreground">AI Inventory Prediction</h1>
          <p className="text-muted-foreground">Smart demand forecasting for All Projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-projects">All Projects</SelectItem>
              <SelectItem value="hq-office">HQ Office Upgrade</SelectItem>
              <SelectItem value="network-expansion">Network Expansion</SelectItem>
              <SelectItem value="server-migration">Server Migration</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {/* Summary Cards */}
      <PredictionSummary selectedProject={selectedProject} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Prediction Table */}
        <div className="xl:col-span-2">
          <PredictionTable selectedProject={selectedProject} />
        </div>

        {/* Demand Prediction Sidebar */}
        <div className="xl:col-span-1">
          <DemandPrediction />
        </div>
      </div>
    </div>
  );
}