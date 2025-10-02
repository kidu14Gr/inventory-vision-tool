import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface PredictionSummaryProps {
  selectedProject: string;
}

export function PredictionSummary({ selectedProject }: PredictionSummaryProps) {
  const KAFKA_API_URL = (import.meta.env.VITE_KAFKA_API_URL as string) || "http://localhost:5000";
  // Lightweight fetch from Kafka API to produce summary counts; synchronous for small scope
  let data = { totalItems: 0, description: "In inventory" };
  try {
    // Synchronously attempt fetch using a minimal XHR via navigator (not ideal SSR-safe) — instead we keep demo numbers
    // For now, keep demo fallback but allow replacement via SmartStockAnalysis which pulls Kafka data.
    if (selectedProject === "all-projects") {
      data = { totalItems: 847, description: "In inventory" };
    } else {
      data = { totalItems: 156, description: "Items needed for project" };
    }
  } catch (e) {
    data = { totalItems: 0, description: "No data" };
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Total Items
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-foreground">{data.totalItems}</div>
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </CardContent>
      </Card>

      {selectedProject !== "all-projects" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Project Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-success">Active</div>
            <p className="text-xs text-muted-foreground">Planning phase</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}