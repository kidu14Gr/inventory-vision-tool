import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, BarChart3, AlertTriangle } from "lucide-react";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { ChatBot } from "@/components/ChatBot";

const Inventory = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const [requestsData, setRequestsData] = useState([]);
  const [transactionsData, setTransactionsData] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const [selectedProjectInventory, setSelectedProjectInventory] = useState("All Projects");
  const [selectedProjectUsage, setSelectedProjectUsage] = useState("All Projects");
  const [selectedProjectDemand, setSelectedProjectDemand] = useState("All Projects");
  const [viewOption, setViewOption] = useState("Quantity");

  // Fetch data on component mount
  useEffect(() => {
    fetchInventoryData();
    fetchRequestsData();
    fetchTransactionsData();
    fetchDemandData();
  }, []);

  const fetchInventoryData = async (project = "All Projects") => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/inventory?project=${encodeURIComponent(project)}&view=${viewOption}`);
      const data = await response.json();
      setInventoryData(data);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };

  const fetchRequestsData = async (project = "All Projects") => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/requests?project=${encodeURIComponent(project)}`);
      const data = await response.json();
      setRequestsData(data);
    } catch (error) {
      console.error("Error fetching requests data:", error);
    }
  };

  const fetchTransactionsData = async (project = "All Projects") => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/transactions?project=${encodeURIComponent(project)}`);
      const data = await response.json();
      setTransactionsData(data);
    } catch (error) {
      console.error("Error fetching transactions data:", error);
    }
  };

  const fetchDemandData = async (project = "All Projects") => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/demand?project=${encodeURIComponent(project)}`);
      const data = await response.json();
      setDemandData(data);
    } catch (error) {
      console.error("Error fetching demand data:", error);
    }
  };

  const handleProjectInventoryChange = (project) => {
    setSelectedProjectInventory(project);
    fetchInventoryData(project);
  };

  const handleProjectUsageChange = (project) => {
    setSelectedProjectUsage(project);
    fetchRequestsData(project);
    fetchTransactionsData(project);
  };

  const handleProjectDemandChange = (project) => {
    setSelectedProjectDemand(project);
    fetchDemandData(project);
  };

  const handleViewOptionChange = (option) => {
    setViewOption(option);
    fetchInventoryData(selectedProjectInventory);
  };



  // Calculate inventory summary
  const inventorySummary = inventoryData.reduce(
    (acc, item) => {
      const status = item.Status;
      if (status === "Critical") acc.critical++;
      else if (status === "Low Stock") acc.lowStock++;
      else acc.sufficient++;
      acc.totalItems++;
      acc.totalPrice += item.amount || 0;
      return acc;
    },
    { critical: 0, lowStock: 0, sufficient: 0, totalItems: 0, totalPrice: 0 }
  );

  // Calculate transaction summary for pie chart
  const transactionSummary = transactionsData.reduce(
    (acc, trans) => {
      acc.requested += trans.requested_quantity || 0;
      acc.consumed += trans.consumed_amount || 0;
      acc.returned += trans.returned_quantity || 0;
      return acc;
    },
    { requested: 0, consumed: 0, returned: 0 }
  );

  // Generate unreturned items alert
  const unreturnedAlert = () => {
    if (selectedProjectUsage === "All Projects") return null;

    const projectRequests = requestsData.filter(req => req.project_display === selectedProjectUsage);
    const unreturned = projectRequests.filter(req =>
      req.returned_quantity === 0 && req.current_consumed_amount === 0
    );

    if (unreturned.length === 0) return null;

    const oldest = unreturned.reduce((oldest, current) => {
      const currentDate = new Date(current.requested_date || current.requester_received_date);
      const oldestDate = new Date(oldest.requested_date || oldest.requester_received_date);
      return currentDate < oldestDate ? current : oldest;
    });

    const daysHeld = Math.floor((new Date().getTime() - new Date(oldest.requested_date || oldest.requester_received_date).getTime()) / (1000 * 60 * 60 * 24));

    return {
      requester: oldest.requester_name || 'Unknown Requester',
      item: oldest.item_name || 'Unknown Item',
      project: oldest.project_display || 'Unknown Project',
      daysHeld
    };
  };

  const alert = unreturnedAlert();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">SCM Real-Time Dashboard</h1>
          <p className="text-muted-foreground">Supply Chain Management Analytics</p>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Inventory Analysis ({selectedProjectInventory})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">View Stock By</label>
              <Select value={viewOption} onValueChange={handleViewOptionChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quantity">Quantity</SelectItem>
                  <SelectItem value="Amount">Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Inventory Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Critical: <strong>{inventorySummary.critical}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Low Stock: <strong>{inventorySummary.lowStock}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Sufficient: <strong>{inventorySummary.sufficient}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Total Items: <strong>{inventorySummary.totalItems}</strong></span>
              </div>
            </div>

            <div className="text-sm">
              <span>Total Price: <strong>{inventorySummary.totalPrice.toLocaleString()} birr</strong></span>
            </div>

            {/* Inventory Table */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Detail Report
                </Button>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  General Report
                </Button>
                <Button variant="outline" size="sm">
                  GRN report
                </Button>
              </div>
            </div>

            <InventoryTable data={inventoryData} />
          </CardContent>
        </Card>

        {/* Usage Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Analytics ({selectedProjectUsage})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProjectUsage} onValueChange={handleProjectUsageChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Projects">All Projects</SelectItem>
                  {[...new Set(requestsData.map(req => req.project_display).filter(Boolean))].map(project => (
                    <SelectItem key={project} value={project}>{project}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Transaction Summary Pie Chart Placeholder */}
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                <p>Transaction Chart</p>
                <p className="text-xs">
                  Requested: {transactionSummary.requested} | Consumed: {transactionSummary.consumed} | Returned: {transactionSummary.returned}
                </p>
              </div>
            </div>

            {/* Unreturned Items Alert */}
            {alert && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Longest unreturned item:</strong><br />
                  {alert.requester} ({alert.project}) requested {alert.item} {alert.daysHeld} days ago
                </AlertDescription>
              </Alert>
            )}

            {!alert && selectedProjectUsage !== "All Projects" && (
              <Alert>
                <AlertDescription>
                  No unreturned or unconsumed items for project {selectedProjectUsage}.
                </AlertDescription>
              </Alert>
            )}


          </CardContent>
        </Card>

        {/* Demand Prediction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Demand Prediction ({selectedProjectDemand})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProjectDemand} onValueChange={handleProjectDemandChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Projects">All Projects</SelectItem>
                  {[...new Set(requestsData.map(req => req.requested_project_name).filter(Boolean))].map(project => (
                    <SelectItem key={project} value={project}>{project}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Demand Prediction Table */}
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Item</th>
                    <th className="text-left">Predicted Date</th>
                    <th className="text-right">Predicted Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {demandData.slice(0, 10).map((pred, index) => (
                    <tr key={index}>
                      <td>{pred.item_name}</td>
                      <td>{pred.predicted_date}</td>
                      <td className="text-right">{pred.predicted_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>





      {/* Floating ChatBot */}
      <ChatBot />
    </div>
  );
};

export default Inventory;
