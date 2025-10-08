// src/components/ChatBot.tsx
import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { consumeKafkaTopic } from "@/lib/services/kafkaService";
import { generateGeminiResponse } from "@/lib/services/LLMService";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

/* Utility helpers (unchanged behavior) */
const normalize = (s?: string) => (s || "").toString().trim().toLowerCase();
const safeToNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const findProjectFromText = (q: string, requestsDf: any[]): string | null => {
  const projects = Array.from(
    new Set(
      (requestsDf || []).map((r: any) =>
        normalize(r.project_display || r.requested_project_name)
      )
    )
  ).filter(Boolean);

  for (const p of projects) {
    const re = new RegExp(
      `\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(q)) return p;
  }
  return null;
};

const findItemFromText = (
  q: string,
  requestsDf: any[],
  inventoryDf: any[]
): string | null => {
  const itemsSet = new Set<string>();
  (requestsDf || []).forEach(
    (r: any) => r.item_name && itemsSet.add(normalize(r.item_name))
  );
  (inventoryDf || []).forEach(
    (i: any) => i.item_name && itemsSet.add(normalize(i.item_name))
  );
  const items = Array.from(itemsSet).filter(Boolean);

  for (const it of items) {
    const re = new RegExp(
      `\\b${it.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(q)) return it;
  }
  return null;
};

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your AI inventory assistant. How can I help you today?",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inventory, requests] = await Promise.all([
          consumeKafkaTopic("scm_inventory", undefined, 5000, "earliest"),
          consumeKafkaTopic("scm_requests", undefined, 5000, "earliest"),
        ]);
        setInventoryData(Array.isArray(inventory) ? inventory : []);
        setRequestsData(Array.isArray(requests) ? requests : []);
        console.log(
          `Loaded ${
            Array.isArray(inventory) ? inventory.length : 0
          } inventory records and ${
            Array.isArray(requests) ? requests.length : 0
          } request records.`
        );
      } catch (error) {
        console.error("Failed to fetch data for chatbot:", error);
        setInventoryData([]);
        setRequestsData([]);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(t);
  }, [messages]);

  /* Helper: clean LLM response from markdown formatting */
  const cleanLLMResponse = (text: string): string => {
    let cleaned = text;

    // Remove asterisks used for bold/emphasis (**text** or *text*)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");

    // Remove markdown headers (# ## ###)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

    // Remove markdown list markers at the start of lines (-, *, •)
    cleaned = cleaned.replace(/^[\s]*[-*•]\s+/gm, "");

    // Remove numbered list markers (1. 2. 3.)
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "");

    // Clean up any double spaces created by removals
    cleaned = cleaned.replace(/  +/g, " ");

    // Clean up excessive line breaks (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned.trim();
  };

  /* Helper: create data summary statistics */
  const summarizeData = (requests: any[], inventory: any[]) => {
    const summary: any = {
      requestStats: {},
      inventoryStats: {},
      recentRequests: [],
      topItems: [],
    };

    // Request statistics
    if (requests.length > 0) {
      const itemQuantities: Record<string, number> = {};
      const projectRequests: Record<string, number> = {};

      requests.forEach((r: any) => {
        const item = r.item_name || "Unknown";
        const qty = safeToNumber(r.requested_quantity || r.quantity);
        const proj = r.project_display || r.requested_project_name || "Unknown";

        itemQuantities[item] = (itemQuantities[item] || 0) + qty;
        projectRequests[proj] = (projectRequests[proj] || 0) + 1;
      });

      summary.requestStats = {
        totalRequests: requests.length,
        uniqueItems: Object.keys(itemQuantities).length,
        uniqueProjects: Object.keys(projectRequests).length,
        topItemsByQuantity: Object.entries(itemQuantities)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 10)
          .map(([item, qty]) => ({ item, quantity: qty })),
        topProjects: Object.entries(projectRequests)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([project, count]) => ({ project, count })),
      };

      // Most recent requests (limit to 50)
      summary.recentRequests = requests.slice(-50).map((r: any) => ({
        item: r.item_name,
        quantity: r.requested_quantity || r.quantity,
        project: r.project_display || r.requested_project_name,
        date: r.requested_date || r.date,
        status: r.status,
      }));
    }

    // Inventory statistics
    if (inventory.length > 0) {
      summary.inventoryStats = {
        totalItems: inventory.length,
        items: inventory.slice(0, 100).map((i: any) => ({
          name: i.item_name,
          quantity: i.quantity_available || i.quantity,
          unit: i.unit,
          location: i.warehouse_location,
        })),
      };
    }

    return summary;
  };

  const askChatbot = async (
    userQuestion: string,
    inventoryDf: any[],
    requestsDf: any[]
  ): Promise<string> => {
    const qRaw = userQuestion.toString().trim();
    const q = qRaw.toLowerCase();

    const greetingRe = /\b(hi|hello|hey|what can you do|help)\b/i;
    if (greetingRe.test(q)) {
      return "Hi! I can help you analyze inventory levels, forecast demand, summarize project usage, and provide stock insights. What would you like to know?";
    }

    // Entity extraction
    const projectName = findProjectFromText(qRaw, requestsDf);
    const itemName = findItemFromText(qRaw, requestsDf, inventoryDf);

    // Filter relevant request rows (limit to most recent 200 for context)
    const filteredRequests = (requestsDf || [])
      .filter((r: any) => {
        const itemMatch =
          !itemName || normalize(r.item_name) === normalize(itemName);
        const projectMatch =
          !projectName ||
          normalize(r.project_display || r.requested_project_name) ===
            normalize(projectName);
        return itemMatch && projectMatch;
      })
      .slice(-200); // Reduced from 1000 to 200

    const relevantInventory = (inventoryDf || [])
      .filter(
        (i: any) => !itemName || normalize(i.item_name) === normalize(itemName)
      )
      .slice(0, 100); // Limit to 100 items

    if (!filteredRequests.length && !relevantInventory.length) {
      return "I could not find any inventory or request data relevant to your question. Please try a different item or project name.";
    }

    // Create summarized data instead of raw CSV
    const dataSummary = summarizeData(filteredRequests, relevantInventory);

    // Compose LLM prompt with summarized data
    const prompt = [
      "You are an expert Supply Chain Analyst AI assistant. Your role is to provide insightful, conversational analysis of inventory and supply chain data.",
      `CURRENT DATE: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "--- USER QUESTION ---",
      qRaw,
      "",
      "--- DATA SUMMARY ---",
      "",
      "REQUEST STATISTICS:",
      `- Total Requests: ${dataSummary.requestStats.totalRequests || 0}`,
      `- Unique Items: ${dataSummary.requestStats.uniqueItems || 0}`,
      `- Unique Projects: ${dataSummary.requestStats.uniqueProjects || 0}`,
      "",
      "TOP ITEMS BY QUANTITY:",
      JSON.stringify(
        dataSummary.requestStats.topItemsByQuantity || [],
        null,
        2
      ),
      "",
      "TOP PROJECTS:",
      JSON.stringify(dataSummary.requestStats.topProjects || [], null, 2),
      "",
      "RECENT REQUESTS (Last 50):",
      JSON.stringify(dataSummary.recentRequests || [], null, 2),
      "",
      "INVENTORY STATUS:",
      `- Total Items in Inventory: ${
        dataSummary.inventoryStats.totalItems || 0
      }`,
      JSON.stringify(dataSummary.inventoryStats.items || [], null, 2),
      "",
      "CRITICAL RESPONSE GUIDELINES:",
      "",
      "FORMAT RULES (MUST FOLLOW):",
      "- Write in flowing paragraphs like you're speaking to a colleague",
      "- NEVER use asterisks (*) or any markdown formatting",
      "- NEVER use numbered lists (1. 2. 3.) or bullet points",
      "- NEVER use bold, italics, or special formatting characters",
      "- DO NOT structure responses as lists or sections with headers",
      "- Write naturally as if you're having a conversation",
      "",
      "CONTENT STYLE:",
      "- Keep responses SHORT and CONCISE (2-3 paragraphs maximum)",
      "- Start with a direct answer or key insight",
      "- Weave only the MOST IMPORTANT data points naturally into sentences",
      "- Focus on actionable insights rather than exhaustive details",
      "- Be brief and to the point while remaining conversational",
      "- End with 1-2 key recommendations if relevant",
      "",
      "EXAMPLE OF GOOD RESPONSE:",
      "Looking at the HQ project, Ethiopian incorporated leads at 180 units, followed by ID Cards at 150 units. Recent patterns show a shift toward construction materials like gypsum and copper pipes, suggesting facility upgrades. I'd recommend keeping stock for your top two items well ahead of demand and monitoring those emerging infrastructure needs.",
      "",
      "Now provide your analysis in this natural, conversational style:",
    ].join("\n");

    // Call AI service
    try {
      const response = await generateGeminiResponse(prompt);
      if (response && response.trim()) {
        // Clean the response from any markdown formatting
        return cleanLLMResponse(response);
      }
      return "I processed the data, but the AI returned an empty response. Try rephrasing your question or providing a more specific item or project.";
    } catch (e) {
      console.error("AI inference failed:", e);

      const error = e as Error;
      const errorMessage = error.message || "";

      // Check for specific error types
      if (
        errorMessage.includes("context length") ||
        errorMessage.includes("maximum context")
      ) {
        return "The data set is too large for a single query. Please try asking about a specific item or project to narrow down the results.";
      } else if (
        errorMessage.includes("503") ||
        errorMessage.includes("overloaded")
      ) {
        return "The AI model is currently experiencing high demand. I've automatically retried the request, but it's still unavailable. Please wait a few minutes and try again.";
      } else if (
        errorMessage.includes("429") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("rate limit")
      ) {
        return "API rate limit reached. Please wait a moment and try again.";
      } else if (
        errorMessage.includes("403") ||
        errorMessage.includes("forbidden")
      ) {
        return "API access denied. Please check your API key configuration.";
      } else if (
        errorMessage.includes("500") ||
        errorMessage.includes("internal")
      ) {
        return "The AI service is experiencing internal issues. Please try again in a few minutes.";
      }

      return "Sorry — the AI service failed to generate a response. Please try asking about a specific item or project.";
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const botResponseText = await askChatbot(
        newMessage.text,
        inventoryData,
        requestsData
      );
      const botResponse: Message = {
        id: messages.length + 2,
        text: botResponseText,
        sender: "bot",
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorResponse: Message = {
        id: messages.length + 2,
        text: "Sorry, a critical error occurred while processing your request.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-[100]"
          size="icon"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[80vh] max-h-[600px] shadow-2xl flex flex-col z-[100] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-blue-600 text-white shrink-0">
            <CardTitle className="text-lg">AI Inventory Assistant</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 hover:bg-white/20"
            >
              <X className="h-4 w-4 text-white" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
            <div
              ref={scrollAreaRef}
              className="flex-1 p-4 overflow-y-auto min-h-0"
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 max-h-64 overflow-y-auto ${
                        message.sender === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-line">
                        {message.text}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-800 rounded-lg p-3 max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <span className="text-sm">Analyzing data...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 p-4 border-t border-gray-300 bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about forecast, stock status, or summary..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) handleSend();
                  }}
                  disabled={loading}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  disabled={loading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}