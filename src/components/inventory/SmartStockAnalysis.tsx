import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, BarChart3, AlertTriangle, Package2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SmartStockAnalysisProps {
  selectedProject: string;
}

export function SmartStockAnalysis({ selectedProject }: SmartStockAnalysisProps) {
  const [viewType, setViewType] = useState<"amount" | "quantity">("quantity");
  const [inventoryProject, setInventoryProject] = useState(selectedProject);
  const [analyticsProject, setAnalyticsProject] = useState(selectedProject);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [usageData, setUsageData] = useState<any>({});
  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const projectOptions = [
    { value: "All Projects", label: "All Projects" },
    { value: "PROJECT A", label: "Project A" },
    { value: "PROJECT B", label: "Project B" }
  ];

  useEffect(() => {
    fetchInventoryData();
  }, [inventoryProject, viewType]);

  useEffect(() => {
    fetchUsageData();
  }, [analyticsProject]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const { data: inventoryResponse, error: inventoryError } = await supabase.functions.invoke(
        'get-inventory-data',
        { body: { project: inventoryProject } }
      );

      if (inventoryError) throw inventoryError;
      setInventoryData(inventoryResponse.data || []);
      setSummary(inventoryResponse.summary || {});
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    try {
      const { data: usageResponse, error: usageError } = await supabase.functions.invoke(
        'get-usage-data',
        { body: { project: analyticsProject } }
      );

      if (usageError) throw usageError;
      setUsageData(usageResponse.analytics || {});
      setAlert(usageResponse.alert || null);
    } catch (error) {
      console.error("Error fetching usage data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch usage analytics",
        variant: "destructive"
      });
    }
  };

  const pieChartData = [
    { name: "Requested", value: usageData.requested || 0, color: "#3b82f6" },
    { name: "Consumed", value: usageData.consumed || 0, color: "#ef4444" },
    { name: "Returned", value: usageData.returned || 0, color: "#10b981" }
  ];

  return (
    <div className="space-y-6">
      {/* Inventory Analysis Table & Usage Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enhanced Analysis Table */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Package2 className="h-5 w-5 text-primary" />
                  Inventory Analysis
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={inventoryProject} onValueChange={setInventoryProject}>
                    <SelectTrigger className="w-40">
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
                  <Select value={viewType} onValueChange={(value: "amount" | "quantity") => setViewType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Metrics after project selection */}
              {summary.totalItems > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-destructive/10">
                    <p className="text-2xl font-bold text-destructive">{summary.critical}</p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                  <div className="p-3 rounded-lg border-l-4 border-l-yellow-500 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10">
                    <p className="text-2xl font-bold text-yellow-600">{summary.lowStock}</p>
                    <p className="text-xs text-muted-foreground">Low Stock</p>
                  </div>
                  <div className="p-3 rounded-lg border-l-4 border-l-green-500 bg-gradient-to-br from-green-500/5 to-green-500/10">
                    <p className="text-2xl font-bold text-green-600">{summary.sufficient}</p>
                    <p className="text-xs text-muted-foreground">Sufficient</p>
                  </div>
                  <div className="p-3 rounded-lg border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-primary/10">
                    <p className="text-2xl font-bold text-primary">{summary.totalValue?.toLocaleString()} birr</p>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Item Name</th>
                    <th className="text-left p-4 font-semibold text-sm">Price</th>
                    <th className="text-left p-4 font-semibold text-sm">Date Purchased</th>
                    <th className="text-left p-4 font-semibold text-sm">Store Name</th>
                    <th className="text-left p-4 font-semibold text-sm">Amount</th>
                    <th className="text-left p-4 font-semibold text-sm">Quantity</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Loading inventory data...
                      </td>
                    </tr>
                  ) : inventoryData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No inventory data available
                      </td>
                    </tr>
                  ) : (
                    inventoryData.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200">
                        <td className="p-4">
                          <div className="font-semibold text-sm">{item.item_name}</div>
                        </td>
                        <td className="p-4 text-sm font-semibold">{item.price} birr</td>
                        <td className="p-4 text-sm text-muted-foreground">{item.date_of_purchased}</td>
                        <td className="p-4 text-sm">{item.store_store_name}</td>
                        <td className="p-4">
                          <div className="text-sm font-bold">{item.amount}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold">{item.quantity}</div>
                        </td>
                        <td className="p-4">
                          <Badge className={`${
                            item.status.includes("Critical") 
                              ? "bg-destructive/10 text-destructive border-destructive/20" :
                            item.status.includes("Low")
                              ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                              : "bg-green-500/10 text-green-600 border-green-500/20"
                          }`}>
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Usage Analytics Pie Chart */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Usage Analytics
              </CardTitle>
              <Select value={analyticsProject} onValueChange={setAnalyticsProject}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Project" />
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
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Requested</span>
                </div>
                <span className="font-semibold">{usageData.requested || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Consumed</span>
                </div>
                <span className="font-semibold">{usageData.consumed || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Returned</span>
                </div>
                <span className="font-semibold">{usageData.returned || 0}</span>
              </div>
            </div>

            {/* Overdue Alerts */}
            {alert && (
              <div className="mt-6">
                <Alert variant={alert.type === "warning" ? "destructive" : "default"}>
                  <div className="flex items-start gap-2">
                    {alert.type === "warning" && <AlertTriangle className="h-4 w-4" />}
                    <AlertDescription className="whitespace-pre-line text-xs">
                      {alert.message}
                    </AlertDescription>
                  </div>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
