import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Briefcase, Package } from "lucide-react";
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
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100">
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          Demand Prediction
          {kafkaStatus && (
            <span className="ml-4 text-sm text-gray-600 bg-white px-2 py-1 rounded-full border">
              Kafka: <strong className={kafkaStatus.startsWith('ok') ? 'text-green-600' : 'text-red-600'}>{kafkaStatus}</strong>
            </span>
          )}
          {mlStatus && (
            <span className="ml-2 text-sm text-gray-600 bg-white px-2 py-1 rounded-full border">
              ML: <strong className={mlStatus.startsWith('ok') ? 'text-green-600' : 'text-red-600'}>{mlStatus}</strong>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Selection Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  Select Project
                </label>
                <Select value={selectedPredictionProject} onValueChange={setSelectedPredictionProject}>
                  <SelectTrigger className="h-8 border-2 border-blue-200 hover:border-blue-300 focus:border-blue-400 transition-colors">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-32">
                    {projectOptions.map((project) => (
                      <SelectItem key={project} value={project}>
                        {project}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-500" />
                  Select Item
                </label>
                <Select value={selectedItem} onValueChange={(value) => {
                  setSelectedItem(value);
                  setPredictedAmount(null);
                }}>
                  <SelectTrigger className="h-8 border-2 border-green-200 hover:border-green-300 focus:border-green-400 transition-colors">
                    <SelectValue placeholder="Choose an item..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-32">
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
              className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Predicting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Predict Demand
                </div>
              )}
            </Button>
          </div>

          {/* Prediction Result Section */}
          <div className="flex items-start justify-center">
            {predictedAmount !== null && selectedItem ? (
              <div className="w-full p-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Predicted Amount Needed</p>
                    <p className="text-lg font-semibold mt-1 text-gray-800">{selectedItem}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <Badge className="text-2xl px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold shadow-md">
                      {typeof predictedAmount === 'number' ? Number(predictedAmount).toFixed(2) : predictedAmount} units
                    </Badge>
                    {predictionError && (
                      <div className="text-xs text-red-500 mt-2 bg-red-50 px-2 py-1 rounded-md">
                        ⚠️ {predictionError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full p-6 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select project and item to see prediction</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}