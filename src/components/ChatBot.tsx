import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { consumeKafkaTopic } from "@/lib/services/kafkaService";
import { generateGeminiResponse } from "@/lib/services/geminiService";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I help you with your inventory today?", sender: "bot" }
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
          consumeKafkaTopic("scm_requests", undefined, 5000, "earliest")
        ]);
        setInventoryData(inventory);
        setRequestsData(requests);
      } catch (error) {
        console.error("Failed to fetch data for chatbot:", error);
        // Do not use mock data - keep arrays empty to indicate no data available
        setInventoryData([]);
        setRequestsData([]);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  }, [messages]);

  const askChatbot = async (userQuestion: string, inventoryDf: any[], requestsDf: any[]): Promise<string> => {
    // Basic guards
    if (!userQuestion || !userQuestion.toString().trim()) {
      return "Please ask a valid question about inventory, usage, or forecasts.";
    }

    const q = userQuestion.toString().trim();
    const qLower = q.toLowerCase();

    // 1) Small talk / greetings -> short friendly reply (do not run analysis)
    const greetingRe = /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|what's up)\b/i;
    if (greetingRe.test(qLower)) {
      return "Hi! 👋 I can summarize usage, show unreturned items, or predict next-week demand. Try: 'Top items last month' or 'Predict next week demand for Cement in PROJECT_X'.";
    }

    // 2) Help / capabilities
    const helpRe = /\b(help|what can you do|capabilities|how to use)\b/i;
    if (helpRe.test(qLower)) {
      return (
        "I can:\n" +
        "- Summarize requests over a timeframe (e.g. 'summary for last month')\n" +
        "- List top requested items (e.g. 'top 5 items last 3 months')\n" +
        "- Identify unreturned items for a project (e.g. 'unreturned items for PROJECT_X')\n" +
        "- Forecast next-week demand for an item (e.g. 'predict next week demand for Cement in PROJECT_X')\n" +
        "- Identify high-demand items (e.g. 'what items are in critical state')"
      );
    }

    // Helpers
    const uniqueProjects = Array.from(new Set((requestsDf || []).map((r: any) => (r.project_display || r.requested_project_name || '').toString()).filter(Boolean)));
    let projectName: string | null = null;
    const tokens = q.match(/[A-Za-z0-9_-]+/g) || [];
    for (const t of tokens) {
      if (uniqueProjects.includes(t) || uniqueProjects.includes(t.toUpperCase())) {
        projectName = uniqueProjects.includes(t) ? t : t.toUpperCase();
        break;
      }
    }

    const uniqueItems = Array.from(new Set(((requestsDf || []).map((r: any) => r.item_name).concat((inventoryDf || []).map((i: any) => i.item_name))).filter(Boolean)));
    let itemName: string | null = null;
    for (const it of uniqueItems) {
      if (!it) continue;
      const itLower = it.toString().toLowerCase();
      if (qLower.includes(itLower)) {
        itemName = it;
        break;
      }
    }

    // Intent detection
    const forecastKeywords = ["next week", "next-week", "next month", "forecast", "predict", "prediction", "required"];
    const unreturnedKeywords = ["unreturned", "not returned", "still with", "longest unreturned", "unconsumed"];
    const summaryKeywords = ["summary", "top", "most requested", "top requested", "trend", "analysis", "how many", "total"];
    const inventoryStatusKeywords = ["critical", "low stock", "stock status", "needed", "urgent"];

    const isForecast = forecastKeywords.some(k => qLower.includes(k));
    const isUnreturned = unreturnedKeywords.some(k => qLower.includes(k));
    const isSummary = summaryKeywords.some(k => qLower.includes(k));
    const isInventoryStatus = inventoryStatusKeywords.some(k => qLower.includes(k));

    // INVENTORY STATUS
    if (isInventoryStatus) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const period = (requestsDf || []).filter((r: any) => {
        const d = r.requested_date ? new Date(r.requested_date) : null;
        return d && d >= threeMonthsAgo;
      });
      if (!period || !period.length) return "No recent request data available to assess item status.";
      const counts: Record<string, number> = {};
      for (const r of period) counts[r.item_name] = (counts[r.item_name] || 0) + (Number(r.requested_quantity) || 1);
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topText = top.map(([i, c]) => `${i} (${c})`).join(', ');
      return `I do not have current stock levels to determine a true 'critical state'. However, based on highest request volume in the last 3 months, the items in highest demand are: ${topText}. Recommendation: Verify stock levels for these items.`;
    }

    // FORECAST
    if (isForecast) {
      if (itemName) {
        // Try Gemini first
        if (generateGeminiResponse) {
          try {
            const csvRows = (requestsDf || []).map((r: any) => `${r.project_display||r.requested_project_name||''},${r.item_name||''},${r.requested_quantity||''},${r.requested_date||''}`).join('\n');
            const prompt = `You are a concise forecasting assistant for inventory. INPUT: CSV rows below contain columns project_display,item_name,requested_quantity,requested_date. TASK: produce a single-line Forecast for the named item with the numeric predicted next-week quantity and a one-sentence rationale. If data is insufficient, reply: 'INSUFFICIENT_DATA'.\n\nITEM: ${itemName}\nPROJECT: ${projectName || 'ALL'}\n\nDATA:\nproject_display,item_name,requested_quantity,requested_date\n${csvRows}\n\nREPLY (exact format):\nForecast: <number> units — <one-sentence rationale>`;
            const resp = await generateGeminiResponse(prompt);
            if (!resp || /INSUFFICIENT_DATA/i.test(resp)) throw new Error('insufficient');
            return resp;
          } catch (err) {
            console.warn('Gemini forecast failed, falling back to local heuristic', err);
          }
        }

        // Local heuristic: average weekly demand last 12 weeks
        try {
          const dfLocal = (requestsDf || []).filter((r: any) => r.item_name === itemName && r.requested_date).map((r: any) => ({
            date: new Date(r.requested_date), qty: Number(r.requested_quantity) || 0, project: r.project_display || r.requested_project_name
          }));
          const recent = new Date(); recent.setDate(recent.getDate() - 7*12);
          const filtered = dfLocal.filter((r: any) => r.date >= recent && (!projectName || r.project === projectName));
          if (!filtered.length) return `Insufficient historical data to predict next-week demand for '${itemName}'.`;
          // aggregate by ISO week (approx by rounding to Monday)
          const weeks: Record<string, number> = {};
          for (const r of filtered) {
            const monday = new Date(r.date);
            const day = monday.getDay();
            const diff = (day + 6) % 7; // days since Monday
            monday.setDate(monday.getDate() - diff);
            const key = monday.toISOString().slice(0,10);
            weeks[key] = (weeks[key] || 0) + r.qty;
          }
          const vals = Object.values(weeks);
          if (!vals.length) return `Insufficient weekly aggregation data for '${itemName}'.`;
          const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
          return `Forecast: ${avg.toFixed(1)} units — based on the average weekly requests over the last ${vals.length} weeks.`;
        } catch (e) {
          console.warn('Local forecast failed', e);
          return 'Unable to produce a forecast due to insufficient or malformed data.';
        }
      } else {
        // No item -> top likely items
        const monthsList = [3,6,9,12];
        let items: string[] = [];
        let monthsUsed = 3;
        for (const m of monthsList) {
          const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - m);
          const recent = (requestsDf || []).filter((r:any) => r.requested_date && new Date(r.requested_date) >= cutoff && (!projectName || (r.project_display||r.requested_project_name) === projectName));
          const counts: Record<string, number> = {};
          for (const r of recent) counts[r.item_name] = (counts[r.item_name]||0) + 1;
          const list = Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([k]) => k);
          if (list.length) { items = list; monthsUsed = m; break; }
        }
        if (!items.length) return 'Insufficient historical data to forecast items for next week.';
        const topList = items.slice(0,5).join(', ');
        return projectName ? `Based on the last ${monthsUsed} months, project '${projectName}' is likely to request: ${topList} next week.` : `Based on the last ${monthsUsed} months, the likely items next week are: ${topList}.`;
      }
    }

    // UNRETURNED
    if (isUnreturned) {
      if (!projectName) return "Please specify the project to check unreturned items (e.g. 'unreturned items for PROJECT_X').";
      const projReqs = (requestsDf || []).filter((r:any) => (r.project_display||r.requested_project_name) === projectName);
      if (!projReqs.length) return `No request data for project ${projectName}.`;
      const unreturned = projReqs.filter((r:any) => (Number(r.returned_quantity) || 0) === 0 && (Number(r.current_consumed_amount) || 0) === 0);
      if (!unreturned.length) return `No unreturned or unconsumed items for project ${projectName}.`;
      const withDates = unreturned.map((r:any) => ({...r, relevant: r.requester_received_date || r.requested_date})).filter(r => r.relevant).sort((a,b) => new Date(a.relevant).getTime() - new Date(b.relevant).getTime());
      const oldest = withDates[0];
      const requester = oldest.requester_name || 'Unknown Requester';
      const item = oldest.item_name || 'Unknown Item';
      const date = new Date(oldest.relevant).toISOString().slice(0,10);
      const daysHeld = Math.floor((Date.now() - new Date(oldest.relevant).getTime()) / (1000*60*60*24));
      return `⚠️ Longest unreturned/unconsumed item:\n- ${requester} (Project: ${projectName}) requested ${item} on ${date} (${daysHeld} days ago)`;
    }

    // SUMMARY / ANALYSIS
    if (isSummary || (q.split(/\s+/).length > 3 && !isInventoryStatus)) {
      // Parse time period from query
      let periodMonths = 3; // default
      let periodDays = 0;
      let periodString = 'last 3 months';
      let when = '';
      let unit = '';
      const periodRe = /(this|last)\s+(week|month|3 months|6 months|year)/i;
      const match = q.match(periodRe);
      if (match) {
        when = match[1].toLowerCase();
        unit = match[2].toLowerCase();
        if (unit === 'week') {
          periodDays = when === 'this' ? 7 : 14;
          periodMonths = 0;
          periodString = `${when} week`;
        } else if (unit === 'month') {
          periodMonths = when === 'this' ? 1 : 2;
          periodString = `${when} month`;
        } else if (unit === '3 months') {
          periodMonths = 3;
          periodString = 'last 3 months';
        } else if (unit === '6 months') {
          periodMonths = 6;
          periodString = 'last 6 months';
        } else if (unit === 'year') {
          periodMonths = 12;
          periodString = 'last year';
        }
      }

      const cutoff = new Date();
      if (periodMonths && unit !== 'month') {
        cutoff.setMonth(cutoff.getMonth() - periodMonths);
      } else if (unit === 'month') {
        if (when === 'this') {
          cutoff = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1);
        } else {
          cutoff = new Date(cutoff.getFullYear(), cutoff.getMonth() - 1, 1);
        }
      } else if (unit === 'week') {
        if (when === 'this') {
          // Start of current week (Monday)
          const now = new Date();
          const dayOfWeek = now.getDay(); // 0 = Sunday
          const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          cutoff.setDate(now.getDate() - daysSinceMonday);
          cutoff.setHours(0, 0, 0, 0);
        } else { // last
          // Start of last week (Monday)
          const now = new Date();
          const dayOfWeek = now.getDay();
          const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          cutoff.setDate(now.getDate() - daysSinceMonday - 7);
          cutoff.setHours(0, 0, 0, 0);
        }
      } else {
        cutoff.setDate(cutoff.getDate() - periodDays);
      }
      const period = (requestsDf || []).filter((r:any) => r.requested_date && new Date(r.requested_date) >= cutoff && (!projectName || (r.project_display||r.requested_project_name) === projectName));
      if (!period.length) return `No data available for the requested period (${periodString}).`;
      const totalRequested = period.reduce((s:any, r:any) => s + (Number(r.requested_quantity) || 0), 0);
      const avgQty = period.length ? totalRequested / period.length : 0;
      const counts: Record<string, number> = {};
      for (const r of period) counts[r.item_name] = (counts[r.item_name]||0) + 1;
      const topItems = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([i,c]) => `${i} (${c})`).join(', ');

      // Try Gemini summary
      if (generateGeminiResponse) {
        try {
          const csvRows = period.map((r:any) => `${r.project_display||r.requested_project_name||''},${r.item_name||''},${r.requested_quantity||''},${r.requested_date||''}`).join('\n');
          const prompt = `You are a concise inventory analyst. INPUT: CSV rows below contain project_display,item_name,requested_quantity,requested_date. TASK: Produce a short executive summary (max 3 lines):\n1) Headline: State the total requested quantity for the period and calculate the trend (increase/decrease/stable) compared to the immediately preceding period of the same length, based on 'requested_quantity' sum.\n2) Top Items: List the top 3 items and their total requested counts for this period.\n3) Recommendation: Provide one short, actionable recommendation based on the data. If data insufficient, reply 'NO_DATA'.\n\nPERIOD: ${periodString}\nDATA:\nproject_display,item_name,requested_quantity,requested_date\n${csvRows}\n\nREPLY (plain text, max 3 lines):`;
          const resp = await generateGeminiResponse(prompt);
          if (resp && !resp.toUpperCase().startsWith('NO_DATA')) return resp;
        } catch (e) {
          console.warn('Gemini summary failed, falling back to local summary', e);
        }
      }

      // Local summary fallback
      return `Summary (${periodString}): Total requested = ${totalRequested}, Avg per request = ${avgQty.toFixed(2)}. Top items: ${topItems || 'No items'}. Recommendation: Review trend and verify stock for top items.`;
    }

    // ITEM-specific fallback
    if (itemName) {
      const itemDf = (requestsDf || []).filter((r:any) => r.item_name === itemName && r.requested_date).map((r:any) => ({...r, date: new Date(r.requested_date), qty: Number(r.requested_quantity)||0}));
      if (!itemDf.length) return `No historical requests found for item '${itemName}'.`;
      const totalRequested = itemDf.reduce((s:any, r:any) => s + r.qty, 0);
      const last = itemDf.sort((a,b) => b.date.getTime() - a.date.getTime())[0];
      let recentAvg: number | null = null;
      try {
        const recentCut = new Date(); recentCut.setDate(recentCut.getDate() - 7*12);
        const weeklyCounts: Record<string, number> = {};
        for (const r of itemDf.filter((d:any)=>d.date>=recentCut)) {
          const monday = new Date(r.date); const day = monday.getDay(); const diff = (day+6)%7; monday.setDate(monday.getDate()-diff);
          const key = monday.toISOString().slice(0,10);
          weeklyCounts[key] = (weeklyCounts[key]||0) + r.qty;
        }
        const vals = Object.values(weeklyCounts);
        if (vals.length && vals.reduce((s,v)=>s+v,0)>0) recentAvg = vals.reduce((s,v)=>s+v,0)/vals.length;
      } catch (e) { recentAvg = null; }

      // Try to find price info from inventoryDf
      const invMatch = (inventoryDf || []).find((inv:any) => (inv.item_name || '').toString().toLowerCase() === (itemName || '').toString().toLowerCase());
      const priceText = invMatch && (invMatch.price || invMatch.unitPrice || invMatch.amount) ? `${(Number(invMatch.price || invMatch.unitPrice || invMatch.amount) || 0).toFixed(2)} Birr` : null;

      let resp = `Item '${itemName}' — Total requested (all time): ${totalRequested} units. Most recent request on ${new Date(last.date).toISOString().slice(0,10)}.`;
      if (priceText) resp += ` Unit price: ${priceText}.`;
      if (recentAvg !== null) resp += ` Recent average weekly demand is ~${recentAvg.toFixed(1)} units (last 12 weeks).`;
      return resp;
    }

    // If nothing matched
    return ("I didn't understand exactly what you'd like. Try one of these options:\n" +
            "- 'Give me a summary for last month'\n" +
            "- 'Predict next week demand for Cement in PROJECT_X'\n" +
            "- 'Show unreturned items for PROJECT_Y'\n" +
            "- 'What items are in critical state?'");
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user"
    };

    setMessages([...messages, newMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const botResponseText = await askChatbot(inputValue, inventoryData, requestsData);
      const botResponse: Message = {
        id: messages.length + 2,
        text: botResponseText,
        sender: "bot"
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      const errorResponse: Message = {
        id: messages.length + 2,
        text: "Sorry, I encountered an error processing your request.",
        sender: "bot"
      };
      setMessages(prev => [...prev, errorResponse]);
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
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-50"
          size="icon"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[80vh] shadow-2xl flex flex-col z-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-blue-600 text-white">
            <CardTitle className="text-lg">Chat Assistant</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 hover:bg-white/20"
            >
              <X className="h-4 w-4 text-white" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col h-full p-0">
            <div ref={scrollAreaRef} className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 max-h-64 overflow-y-auto ${
                        message.sender === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-line">{message.text}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-800 rounded-lg p-3 max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-300 bg-white flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
                  disabled={loading}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
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
