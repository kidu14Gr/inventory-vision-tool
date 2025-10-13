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
    text: "Welcome to your Supply Chain Management AI! I'm here to help you with anything you need on the platform.",
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
    "Summarize last month's demand?",
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
      `CURRENT DATE (TODAY): ${new Date().toISOString().slice(0, 10)}`,
      "",
      "--- USER QUESTION ---",
      qRaw,
      "",
      "--- IMPORTANT: CHECK DATES CAREFULLY ---",
      "The data below includes 'date' fields. When user asks about specific time periods (last week, this month, etc.):",
      "1. Calculate the exact date range based on CURRENT DATE above",
      "2. Filter the RECENT REQUESTS data by the 'date' field",
      "3. If NO records match the date range, respond with 'No demand/requests found for [period]'",
      "4. NEVER use overall statistics when asked about a specific time period",
      "",
      "--- DATA SUMMARY ---",
      "",
      "REQUEST STATISTICS (OVERALL - Use only if no time period specified):",
      `- Total Requests: ${dataSummary.requestStats.totalRequests || 0}`,
      `- Unique Items: ${dataSummary.requestStats.uniqueItems || 0}`,
      `- Unique Projects: ${dataSummary.requestStats.uniqueProjects || 0}`,
      `- Date Range in Data: ${
        dataSummary.requestStats.dateRange?.min || "N/A"
      } to ${dataSummary.requestStats.dateRange?.max || "N/A"}`,
      "",
      "TOP ITEMS BY QUANTITY (OVERALL):",
      JSON.stringify(
        dataSummary.requestStats.topItemsByQuantity || [],
        null,
        2
      ),
      "",
      "TOP PROJECTS (OVERALL):",
      JSON.stringify(dataSummary.requestStats.topProjects || [], null, 2),
      "",
      "RECENT REQUESTS WITH DATES (Last 50 - FILTER BY DATE FOR TIME-BASED QUERIES):",
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
      "You are a concise AI assistant. Provide SHORT, scannable insights using ONLY bullet points.",
      "",
      "STRICT FORMATTING RULES:",
      "- NEVER write paragraphs or long explanations",
      "- Use ONLY bullet points (-) for every line",
      "- Keep EACH bullet to 1 short sentence (10-15 words max)",
      "- Total response: 3-5 bullets ONLY",
      "- NO introduction text, NO summary paragraphs",
      "- Start immediately with bullets",
      "",
      "DATE-BASED QUERIES (VERY IMPORTANT):",
      "- ALWAYS use the 'date' or 'requested_date' field to filter data by time periods",
      "- When asked about 'last week', 'this month', 'yesterday', etc., calculate the exact date range",
      "- If NO data exists in the requested time period, say 'No demand/requests found for [time period]'",
      "- NEVER provide overall statistics when asked about a specific time period",
      "- Example: If asked 'last week demand' but data is from last month, respond with 'No demand recorded for last week'",
      "",
      "CONTENT RULES:",
      "- First bullet: Key finding with specific number (or 'No data found' if applicable)",
      "- Middle bullets: Important insights with data",
      "- Last bullet: One actionable recommendation",
      "- Use exact item names and quantities",
      "- Be direct and specific",
      "",
      "EXAMPLE (COPY THIS STYLE):",
      "- Ethiopian incorporated leads at 180 units, ID Cards at 150 units",
      "- Construction materials (gypsum, copper) trending up 40% this month",
      "- Top 2 items represent 65% of total demand",
      "- Recommend: Stock buffer 20% above forecast for peak items",
      "",
      "Now respond with 3-5 short bullets only:",
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
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 hover:shadow-blue-500/50 hover:scale-110 transition-all duration-300 z-[100] border-2 border-white"
          size="icon"
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[80vh] max-h-[600px] shadow-2xl flex flex-col z-[100] overflow-hidden rounded-2xl border-2 border-gray-200 backdrop-blur-xl bg-white/95">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-md border-b border-gray-200/50 shrink-0">
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AI Inventory Assistant
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="h-8 w-8 hover:bg-gray-200/50 rounded-full transition-all duration-200 group"
                title="Clear All Chats"
              >
                <Trash2 className="h-4 w-4 text-gray-600 group-hover:text-red-500 transition-colors" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 hover:bg-gray-200/50 rounded-full transition-all duration-200 group"
              >
                <X className="h-4 w-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0 bg-gradient-to-br from-gray-50 to-white">
            <div
              ref={scrollAreaRef}
              className="flex-1 p-4 overflow-y-auto min-h-0"
            >
              <div className="space-y-4">
                {messages.map((message, msgIndex) => (
                  <div
                    key={message.id}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                  >
                    <div
                      className={`flex ${
                        message.sender === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 max-h-64 overflow-y-auto shadow-md transition-all duration-200 hover:shadow-lg ${
                          message.sender === "user"
                            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                            : "bg-white border border-gray-200 text-gray-800"
                        }`}
                      >
                        {message.sender === "bot" ? (
                          <div className="text-sm space-y-3">
                            {message.text.split("\n").map((line, idx) => {
                              const trimmedLine = line.trim();
                              if (
                                trimmedLine.startsWith("•") ||
                                trimmedLine.startsWith("-") ||
                                trimmedLine.match(/^\d+\./)
                              ) {
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-3 group hover:bg-blue-50/50 p-2 rounded-lg transition-all duration-200"
                                  >
                                    <span className="flex-shrink-0 mt-1">
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-200">
                                        <svg
                                          className="w-3 h-3 text-white"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </span>
                                    </span>
                                    <span className="flex-1 leading-relaxed text-gray-700 pt-0.5">
                                      {trimmedLine.replace(/^[•\-\d.]\s*/, "")}
                                    </span>
                                  </div>
                                );
                              }
                              return trimmedLine ? (
                                <p
                                  key={idx}
                                  className="leading-relaxed text-gray-700 pl-2"
                                >
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
                        <div className="mt-4 grid grid-cols-2 gap-3 px-2">
                          {quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleQuickAction(action)}
                              disabled={loading}
                              className="text-xs px-4 py-3 border-2 border-dashed border-blue-300 rounded-xl bg-white text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:shadow-md hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left font-medium group"
                            >
                              <span className="group-hover:translate-x-1 inline-block transition-transform duration-200">
                                {action}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white border border-gray-200 text-gray-800 rounded-2xl p-4 max-w-[80%] shadow-md">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2.5 h-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2.5 h-2.5 bg-gradient-to-r from-pink-500 to-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          Analyzing data...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-200/50 bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-md">
              <div className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about forecast, stock status, or summary..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) handleSend();
                    }}
                    disabled={loading}
                    className="border-2 border-gray-200 focus:border-blue-400 rounded-xl bg-white shadow-sm focus:shadow-md transition-all duration-200"
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    className="bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shrink-0 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                    disabled={loading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="px-4 pb-3">
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">
                    ⚠️
                  </span>
                  <span className="leading-relaxed">
                    The chatbot may make mistakes due to limited or low-quality
                    data.
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
