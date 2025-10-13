// src/components/ChatBot.tsx
import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { consumeKafkaTopic } from "@/lib/services/kafkaService";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  showQuickActions?: boolean;
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
  const initialMessage = {
    id: 1,
    text: "Welcome to your Supply Chain Management AI! I'm here to help you with anything you need on the platform. Start a conversation or ask me about inventory levels, demand forecasting, stock analysis, or any other features.",
    sender: "bot" as const,
    showQuickActions: true,
  };
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [inputValue, setInputValue] = useState("");
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const quickActions = [
    "What are the top requested items?",
    "Show me low stock items",
    "What is demand forecasting?",
    "How do I predict demand?",
  ];

  const handleQuickAction = async (action: string) => {
    const newMessage: Message = {
      id: messages.length + 1,
      text: action,
      sender: "user",
    };

    setMessages((prev) => [...prev, newMessage]);
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

  const handleClearChat = () => {
    setMessages([initialMessage]);
    setInputValue("");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inventory, requests] = await Promise.all([
          consumeKafkaTopic("scm_inventory", undefined, 5000, "earliest"),
          consumeKafkaTopic("scm_requests", undefined, 5000, "earliest"),
        ]);
        setInventoryData(Array.isArray(inventory) ? inventory : []);
        setRequestsData(
          Array.isArray(requests)
            ? requests.sort(
                (a, b) =>
                  new Date(a.requested_date || a.date).getTime() -
                  new Date(b.requested_date || b.date).getTime()
              )
            : []
        );
        console.log(
          `Loaded ${
            Array.isArray(inventory) ? inventory.length : 0
          } inventory records and ${
            Array.isArray(requests) ? requests.length : 0
          } request records.`
        );

        // Debug: log some sample dates from requests
        if (Array.isArray(requests) && requests.length > 0) {
          const dates = requests
            .map((r) => r.requested_date || r.date)
            .filter(Boolean);
          console.log("Sample request dates:", dates.slice(0, 10));
          const uniqueDates = [...new Set(dates)];
          console.log("Unique dates found:", uniqueDates.sort());
        }
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

  /* Helper: format LLM response to preserve bullets and structure */
  const formatLLMResponse = (text: string): string => {
    let formatted = text;

    // Remove markdown bold/emphasis but keep the text
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "$1");
    formatted = formatted.replace(/\*([^*]+)\*/g, "$1");

    // Remove markdown headers but keep the text
    formatted = formatted.replace(/^#{1,6}\s+/gm, "");

    // Normalize bullet points to use • consistently
    formatted = formatted.replace(/^[\s]*[-*]\s+/gm, "• ");

    // Keep numbered lists as is
    formatted = formatted.replace(/^[\s]*(\d+)\.\s+/gm, "$1. ");

    // Clean up excessive spaces
    formatted = formatted.replace(/  +/g, " ");

    // Clean up excessive line breaks (more than 2 consecutive)
    formatted = formatted.replace(/\n{3,}/g, "\n\n");

    return formatted.trim();
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

      // Calculate date range
      const dates = requests
        .map((r) => r.requested_date || r.date)
        .filter(Boolean)
        .map((d) => new Date(d).toISOString().slice(0, 10))
        .sort();
      const minDate = dates.length > 0 ? dates[0] : "N/A";
      const maxDate = dates.length > 0 ? dates[dates.length - 1] : "N/A";

      summary.requestStats = {
        totalRequests: requests.length,
        uniqueItems: Object.keys(itemQuantities).length,
        uniqueProjects: Object.keys(projectRequests).length,
        dateRange: { min: minDate, max: maxDate },
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
        requester: r.requester_name || "Unknown",
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

  // Gemini API configuration
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

  async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function generateGeminiResponse(
    prompt: string,
    maxRetries = 3
  ): Promise<string> {
    if (!GEMINI_API_KEY) {
      throw new Error(
        "Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file."
      );
    }

    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(
          `Calling Gemini API (attempt ${attempt + 1}/${maxRetries})`
        );

        const apiUrl = GEMINI_API_URL + `?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (
          data.candidates &&
          data.candidates.length > 0 &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts.length > 0
        ) {
          const content = data.candidates[0].content.parts[0].text;
          if (content && content.trim()) {
            return content.trim();
          }
        }

        throw new Error("Invalid response format from API");
      } catch (error) {
        lastError = error as Error;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Error with Gemini API (attempt ${attempt + 1}/${maxRetries}):`,
          error
        );

        // For network errors
        if (
          errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("NetworkError")
        ) {
          if (attempt < maxRetries - 1) {
            const delayMs = 2000;
            console.log(`Network error, retrying in ${delayMs}ms...`);
            await sleep(delayMs);
            continue;
          }
        }

        // For other errors, retry with backoff
        if (attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`Error occurred, retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          continue;
        }

        // If this was the last attempt, throw the error
        throw error;
      }
    }

    throw lastError;
  }

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
      `- Date Range: ${dataSummary.requestStats.dateRange?.min || "N/A"} to ${
        dataSummary.requestStats.dateRange?.max || "N/A"
      }`,
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
      "You are a helpful inventory assistant who provides clear, structured insights. Format your responses to be interactive and easy to scan.",
      "",
      "FORMATTING REQUIREMENTS:",
      "- Start with a brief 1-2 sentence summary paragraph",
      "- Then use bullet points (-) to break down key insights",
      "- Each bullet should be concise and actionable",
      "- Use natural, conversational language within bullets",
      "- NO asterisks, bold, or other markdown except bullets",
      "- Keep total response length to 4-6 bullet points maximum",
      "",
      "CONTENT GUIDELINES:",
      "- Lead with the most important insight",
      "- Include specific numbers and item names in bullets",
      "- Focus on actionable information",
      "- Mention trends, patterns, or anomalies",
      "- End with 1-2 recommendations when relevant",
      "- When asked about requesters, use the 'requester' field from data",
      "",
      "EXAMPLE FORMAT:",
      "Looking at the HQ project data, here's what stands out:",
      "- Ethiopian incorporated leads the demand at 180 units, with ID Cards following at 150 units",
      "- Recent requests show a shift toward construction materials like gypsum and copper pipes, suggesting facility upgrades are underway",
      "- Your top two items account for 65% of total project demand",
      "- Recommendation: Keep buffer stock for Ethiopian incorporated and ID Cards at 20% above predicted demand",
      "",
      "Now provide your analysis in this clear, bullet-point format:",
    ].join("\n");

    // Call AI service
    try {
      const response = await generateGeminiResponse(prompt);
      if (response && response.trim()) {
        // Format the response to preserve structure
        return formatLLMResponse(response);
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
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="h-8 w-8 hover:bg-white/20"
                title="Clear All Chats"
              >
                <Trash2 className="h-4 w-4 text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 hover:bg-white/20"
              >
                <X className="h-4 w-4 text-white" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
            <div
              ref={scrollAreaRef}
              className="flex-1 p-4 overflow-y-auto min-h-0"
            >
              <div className="space-y-4">
                {messages.map((message, msgIndex) => (
                  <div key={message.id}>
                    <div
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
                        {message.sender === "bot" ? (
                          <div className="text-sm space-y-2">
                            {message.text.split("\n").map((line, idx) => {
                              const trimmedLine = line.trim();
                              if (
                                trimmedLine.startsWith("•") ||
                                trimmedLine.match(/^\d+\./)
                              ) {
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2 ml-2"
                                  >
                                    <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5">
                                      {trimmedLine.startsWith("•")
                                        ? "•"
                                        : trimmedLine.match(/^\d+\./)?.[0]}
                                    </span>
                                    <span className="flex-1">
                                      {trimmedLine.replace(/^[•\d.]\s*/, "")}
                                    </span>
                                  </div>
                                );
                              }
                              return trimmedLine ? (
                                <p key={idx} className="leading-relaxed">
                                  {line}
                                </p>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-line">
                            {message.text}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Quick Action Buttons - Show only for initial message */}
                    {message.showQuickActions &&
                      msgIndex === 0 &&
                      messages.length === 1 && (
                        <div className="mt-4 grid grid-cols-2 gap-2 px-2">
                          {quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleQuickAction(action)}
                              disabled={loading}
                              className="text-xs px-3 py-2 border-2 border-dashed border-gray-400 rounded-lg bg-white text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left font-medium"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
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
