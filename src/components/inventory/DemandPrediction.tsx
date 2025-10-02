import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

interface DemandPredictionProps {
  selectedProject: string;
}

const allItems = [
  { name: "Network Cables - Cat6 Ethernet", project: "network-expansion" },
  { name: "Power Supplies - UPS 1500VA", project: "server-migration" },
  { name: "Storage Drives - SSD 1TB", project: "server-migration" },
  { name: "Server Memory - 32GB DDR4", project: "server-migration" },
  { name: "Switches - 24-Port Gigabit", project: "network-expansion" },
  { name: "Routers - Enterprise WiFi", project: "hq-office" },
];

const projectOptions = [
  { value: "all-projects", label: "All Projects" },
  { value: "network-expansion", label: "Network Expansion" },
  { value: "server-migration", label: "Server Migration" },
  { value: "hq-office", label: "HQ Office" }
];

export function DemandPrediction({ selectedProject }: DemandPredictionProps) {
  const [selectedPredictionProject, setSelectedPredictionProject] = useState("all-projects");
  const [selectedItem, setSelectedItem] = useState("");
  const [predictedAmount, setPredictedAmount] = useState<number | null>(null);

  const filteredItems = selectedPredictionProject === "all-projects" 
    ? allItems 
    : allItems.filter(item => item.project === selectedPredictionProject);

  const handlePredict = () => {
    if (selectedItem) {
      (async () => {
        const ML_API_URL = (import.meta.env.VITE_ML_API_URL as string) || "http://localhost:8001";
        try {
          const payload = { project_name: selectedPredictionProject, item_name: selectedItem, requested_date: new Date().toISOString().slice(0,10), in_use: 1 };
          const res = await fetch(`${ML_API_URL.replace(/\/+$/, "")}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error('ML API error');
          const body = await res.json();
          setPredictedAmount(body.predicted_quantity ?? null);
        } catch (e) {
          console.warn('Prediction failed', e);
          setPredictedAmount(null);
        }
      })();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Demand Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Project</label>
            <Select value={selectedPredictionProject} onValueChange={setSelectedPredictionProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((project) => (
                  <SelectItem key={project.value} value={project.value}>
                    {project.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Item</label>
            <Select value={selectedItem} onValueChange={(value) => {
              setSelectedItem(value);
              setPredictedAmount(null);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {filteredItems.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handlePredict} 
          disabled={!selectedItem}
          className="w-full md:w-auto"
        >
          Predict
        </Button>

        {predictedAmount !== null && selectedItem && (
          <div className="mt-6 p-4 rounded-lg border bg-gradient-to-br from-company-primary/5 to-company-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicted Amount Needed</p>
                <p className="text-sm font-medium mt-1">{selectedItem}</p>
              </div>
              <Badge className="text-xl px-4 py-2 bg-company-primary text-company-primary-foreground">
                {predictedAmount} units
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}