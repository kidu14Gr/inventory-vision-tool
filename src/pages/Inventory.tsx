import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { AIPredictions } from "@/components/inventory/AIPredictions";

const Inventory = () => {
  const [activeTab, setActiveTab] = useState("items");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Stock</h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="on-use">On Use</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Detail Report
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                General Report
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant={activeTab === "ai-predictions" ? "default" : "outline"} 
                size="sm"
                onClick={() => setActiveTab("ai-predictions")}
              >
                AI Predictions
              </Button>
              <Button variant="outline" size="sm">
                GRN report
              </Button>
            </div>
          </div>

          <InventoryTable />
        </TabsContent>

        <TabsContent value="ai-predictions">
          <AIPredictions />
        </TabsContent>

        {/* Other tabs content can be added here */}
        {["tools", "assets", "project", "request", "on-use"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="text-center py-12 text-muted-foreground">
              {tab.charAt(0).toUpperCase() + tab.slice(1)} content coming soon...
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Inventory;
