import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { consumeKafkaTopic, checkKafkaApi } from "@/lib/services/kafkaService";
import { predictDemand, checkMlApi } from "@/lib/services/mlService";

interface DemandPredictionProps {
  selectedProject: string;
}

interface ProjectOption {
  value: string;
  label: string;
}

interface Item {
  name: string;
  project?: string;
}

export function DemandPrediction({ selectedProject }: DemandPredictionProps) {
  const [selectedPredictionProject, setSelectedPredictionProject] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [predictedAmount, setPredictedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [kafkaStatus, setKafkaStatus] = useState<string | null>(null);
  const [mlStatus, setMlStatus] = useState<string | null>(null);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequestsData = async () => {
      try {
        // Fetch earliest (historical) messages similar to Streamlit behavior
        const data = await consumeKafkaTopic("scm_requests", undefined, 5000, "earliest");

        // Normalize and add project_display similar to streamlit_app
        const normalized = (data || []).map((item: any) => {
          const proj = (item?.requested_project_name ?? item?.project_display ?? item?.project_name ?? item?.project ?? "").toString().trim();
          return { ...item, project_display: proj };
        });

        setRequestsData(normalized);

        // Extract unique projects (sorted). If none, provide placeholder
        const projects = Array.from(new Set(normalized.map((it: any) => it.project_display).filter(Boolean))).sort();
        setProjectOptions(projects.length ? projects : ["No projects available"]);

        // Extract global unique items
        const items = Array.from(new Set(normalized.map((it: any) => it.item_name).filter(Boolean))).sort();
        const itemOpts = items.map(name => ({ name, project: "" }));
        setAllItems(itemOpts);
      } catch (error) {
        console.error("Failed to fetch requests data:", error);
      }
    };

    const checkApis = async () => {
      try {
        const resp = await checkKafkaApi();
        if (resp.ok) setKafkaStatus(`ok (${resp.status})`);
        else if (resp.corsBlocked) setKafkaStatus('CORS blocked');
        else setKafkaStatus(`fail${resp.status ? ` (${resp.status})` : ''}`);
      } catch (e) {
        setKafkaStatus('error');
      }
      try {
        const m = await checkMlApi();
        if (m.ok) setMlStatus(`ok (${m.status})`);
        else setMlStatus(`fail${m.status ? ` (${m.status})` : ''}`);
      } catch (e) {
        setMlStatus('error');
      }
    };

    fetchRequestsData();
    checkApis();
  }, []);

  const filteredItems = (selectedPredictionProject && selectedPredictionProject !== "No projects available")
    ? Array.from(new Set(requestsData.filter(r => r.project_display === selectedPredictionProject).map(r => r.item_name).filter(Boolean))).map(name => ({ name, project: selectedPredictionProject }))
    : allItems;

  const handlePredict = async () => {
    if (selectedItem && selectedPredictionProject !== "all-projects") {
      try {
        setLoading(true);
        setPredictionError(null);
        const today = new Date().toISOString().split('T')[0];
        const prediction = await predictDemand({
          project_name: selectedPredictionProject,
          item_name: selectedItem,
          requested_date: today,
          in_use: 1
        });
        // Accept numeric or string numeric; keep decimal precision returned by model
        const numeric = typeof prediction === 'number' ? prediction : Number(prediction);
        if (!Number.isNaN(numeric)) setPredictedAmount(numeric);
        else throw new Error('ML returned non-numeric prediction');
      } catch (error) {
        console.error("Prediction failed:", error);
        // Set user-friendly error and fallback to a small random guess
        const msg = (error as any)?.message || 'Prediction failed';
        setPredictionError(msg);
        const predicted = Math.floor(Math.random() * 50) + 10;
        setPredictedAmount(predicted);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Demand Prediction
          {kafkaStatus && (
            <span className="ml-3 text-sm text-muted-foreground">Kafka API: <strong>{kafkaStatus}</strong></span>
          )}
          {mlStatus && (
            <span className="ml-3 text-sm text-muted-foreground">ML API: <strong>{mlStatus}</strong></span>
          )}
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
                  <SelectItem key={project} value={project}>
                    {project}
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
          disabled={!selectedItem || loading || !selectedPredictionProject || selectedPredictionProject === "No projects available"}
          className="w-full md:w-auto"
        >
          {loading ? "Predicting..." : "Predict"}
        </Button>

        {predictedAmount !== null && selectedItem && (
          <div className="mt-6 p-4 rounded-lg border bg-gradient-to-br from-company-primary/5 to-company-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicted Amount Needed</p>
                <p className="text-sm font-medium mt-1">{selectedItem}</p>
              </div>
              <div className="flex flex-col items-end">
                <Badge className="text-xl px-4 py-2 bg-company-primary text-company-primary-foreground">
                  {typeof predictedAmount === 'number' ? Number(predictedAmount).toFixed(2) : predictedAmount} units
                </Badge>
                {predictionError && <div className="text-xs text-destructive mt-1">{predictionError}</div>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}