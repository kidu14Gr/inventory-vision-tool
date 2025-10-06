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
    {
      id: 1,
      text: "Hello! How can I help you with your inventory today?",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
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

  // Utility helpers
  const normalize = (s?: string) => (s || "").toString().trim().toLowerCase();

  const findProjectFromText = (q: string, requestsDf: any[]): string | null => {
    const projects = Array.from(
      new Set(
        (requestsDf || []).map((r: any) =>
          normalize(r.project_display || r.requested_project_name)
        )
      )
    );
    if (!projects.length) return null;
    // Token/phrase match (prefer exact match)
    for (const p of projects) {
      if (!p) continue;
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
    const items = Array.from(itemsSet);
    if (!items.length) return null;
    // prefer exact phrase match (case-insensitive)
    for (const it of items) {
      if (!it) continue;
      const re = new RegExp(
        `\\b${it.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
      if (re.test(q)) return it;
    }
    // fallback: contains token
    const tokens = q.match(/[A-Za-z0-9_-]{3,}/g) || [];
    for (const t of tokens) {
      const tnorm = normalize(t);
      for (const it of items) {
        if (it === tnorm) return it;
      }
    }
    return null;
  };

  const safeToNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const topByRequests = (
    requestsDf: any[],
    months = 3,
    topN = 5,
    projectName?: string
  ) => {
    if (!requestsDf || !requestsDf.length) return [];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const filtered = (requestsDf || []).filter((r: any) => {
      const d = r.requested_date ? new Date(r.requested_date) : null;
      if (!d) return false;
      if (
        projectName &&
        normalize(r.project_display || r.requested_project_name) !==
          normalize(projectName)
      )
        return false;
      return d >= cutoff;
    });
    const counts: Record<string, number> = {};
    for (const r of filtered) {
      const name = r.item_name || "Unknown";
      counts[name] =
        (counts[name] || 0) + (safeToNumber(r.requested_quantity) || 1);
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([k, v]) => ({ item: k, qty: v }));
  };

  // Main chatbot logic
  const askChatbot = async (
    userQuestion: string,
    inventoryDf: any[],
    requestsDf: any[]
  ): Promise<string> => {
    if (!userQuestion || !userQuestion.toString().trim()) {
      return "Please ask a valid question about inventory, usage, or forecasts.";
    }

    const qRaw = userQuestion.toString().trim();
    const q = qRaw.toLowerCase();

    // greetings / help (do not run heavy analysis)
    const greetingRe =
      /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|what's up)\b/i;
    if (greetingRe.test(q)) {
      return "Hi! 👋 I can summarize requests, check unreturned items, forecast demand, and highlight potential low-stock items. Try: 'Summary last month' or 'Predict next week demand for cement'.";
    }
    const helpRe = /\b(help|what can you do|capabilities|how to use)\b/i;
    if (helpRe.test(q)) {
      return [
        "I can:",
        "- Summarize requests for a timeframe (e.g. 'summary for last month')",
        "- Forecast next-week demand for an item (e.g. 'predict next week demand for Cement in PROJECT_X')",
        "- Identify long unreturned items per project (e.g. 'unreturned items for PROJECT_X')",
        "- Flag potentially low-stock items using inventory levels + recent requests (e.g. 'what items are in critical state')",
      ].join("\n");
    }

    // intent keywords
    const forecastKeywords = [
      "next week",
      "next-week",
      "next month",
      "forecast",
      "predict",
      "prediction",
    ];
    const unreturnedKeywords = [
      "unreturned",
      "not returned",
      "still with",
      "longest unreturned",
      "unconsumed",
    ];
    const summaryKeywords = [
      "summary",
      "summarize",
      "top",
      "most requested",
      "top requested",
      "trend",
      "analysis",
      "statistics",
      "stats",
      "report",
      "overview",
    ];
    // inventory status requires explicit ask; we don't want accidental trigger on 'top' or 'summary'
    const inventoryStatusKeywords = [
      "critical state",
      "critical",
      "low stock",
      "stock status",
      "needed",
      "urgent",
      "low on stock",
      "running out",
    ];

    const isForecast = forecastKeywords.some((k) => q.includes(k));
    const isUnreturned = unreturnedKeywords.some((k) => q.includes(k));
    const isSummary = summaryKeywords.some((k) => q.includes(k));
    const isInventoryStatus = inventoryStatusKeywords.some((k) =>
      q.includes(k)
    );

    // robust project/item detection
    const projectName = findProjectFromText(qRaw, requestsDf) || null;
    const itemName = findItemFromText(qRaw, requestsDf, inventoryDf) || null;

    // ---------------- Inventory Status (STRICT) ----------------
    // Only trigger if user explicitly asks about stock/critical/low stock, and not asking for a simple "top" or "summary".
    if (isInventoryStatus && !isSummary && !isForecast && !isUnreturned) {
      // Prefer inventory data to determine actual low stock; fallback to request-volume heuristic.
      if ((inventoryDf || []).length > 0) {
        // build map by item_name for quick lookup
        const invMap: Record<string, any> = {};
        for (const inv of inventoryDf) {
          if (!inv || !inv.item_name) continue;
          invMap[normalize(inv.item_name)] = inv;
        }

        // compute recent demand (3 months) per item
        const demand = topByRequests(
          requestsDf,
          3,
          50,
          projectName || undefined
        ); // get many to compare
        const candidates: {
          item: string;
          demand: number;
          stock: number | null;
        }[] = [];
        for (const d of demand) {
          const inv = invMap[normalize(d.item)];
          const stock = inv
            ? safeToNumber(
                inv.quantity || inv.stock || inv.amount || inv.available
              ) || 0
            : null;
          candidates.push({ item: d.item, demand: d.qty, stock });
        }

        // Determine items likely low: stock !== null && stock < demand OR missing stock info but very high demand
        const low = candidates
          .filter((c) =>
            c.stock !== null
              ? c.stock < Math.max(5, Math.round(c.demand * 0.25))
              : c.demand > 50
          )
          .sort((a, b) => (a.stock === null ? -1 : b.demand - a.demand))
          .slice(0, 5);

        if (!low.length) {
          return "Inventory data indicates no obvious low-stock items based on recent demand. Recommendation: perform a manual stock check for high-demand items if needed.";
        }
        const txt = low
          .map(
            (l) =>
              `${l.item} — demand(3mo): ${l.demand}${
                l.stock !== null ? `, stock: ${l.stock}` : ""
              }`
          )
          .join("; ");
        return `Items potentially low/critical (based on inventory + recent demand): ${txt}. Recommendation: verify stock and reorder critical items.`;
      }

      // Fallback: no inventory data -> still allow a demand-based heuristic but make it explicit
      const top = topByRequests(requestsDf, 3, 5, projectName || undefined);
      if (!top.length)
        return "Insufficient request history to assess critical items.";
      const topText = top.map((t) => `${t.item} (${t.qty})`).join(", ");
      return `No inventory levels available. Based on highest request volume in the last 3 months, items in highest demand are: ${topText}. Recommendation: verify stock levels for these items.`;
    }

    // ---------------- Forecast ----------------
    if (isForecast) {
      // If user specified an item -> attempt LLM then fallback to local heuristic
      if (itemName) {
        // Build CSV subset (limit rows to avoid huge prompts)
        const rows = (requestsDf || [])
          .slice(-2000)
          .map(
            (r: any) =>
              `${r.project_display || r.requested_project_name || ""},${
                r.item_name || ""
              },${r.requested_quantity || ""},${r.requested_date || ""}`
          )
          .join("\n");
        if (generateGeminiResponse) {
          try {
            const prompt = [
              "You are a precise inventory forecasting assistant. Only use the provided data.",
              "INPUT: CSV rows with columns: project_display,item_name,requested_quantity,requested_date",
              `TARGET ITEM: ${itemName}`,
              `TARGET PROJECT: ${projectName || "ALL_PROJECTS"}`,
              "TASK: Forecast next week demand for the target item.",
              "RULES:",
              "- Analyze historical patterns from the data",
              "- Consider project-specific demand if specified",
              "- Return exactly one line in this format:",
              "- Forecast: <integer> units — <brief rationale based only on data>",
              "- If insufficient data (< 3 requests), reply exactly: INSUFFICIENT_DATA",
              "- Do not make assumptions or use external knowledge",
              "DATA:",
              "project_display,item_name,requested_quantity,requested_date",
              rows,
            ].join("\n");
            const resp = await generateGeminiResponse(prompt);
            if (resp && !/INSUFFICIENT_DATA/i.test(resp)) return resp;
          } catch (e) {
            console.warn(
              "Gemini forecast failed, falling back to local heuristic",
              e
            );
          }
        }

        // Local fallback: average weekly demand over recent weeks
        try {
          const recentCut = new Date();
          recentCut.setDate(recentCut.getDate() - 7 * 12);
          const local = (requestsDf || [])
            .filter(
              (r: any) =>
                r.item_name &&
                normalize(r.item_name) === normalize(itemName) &&
                r.requested_date
            )
            .map((r: any) => ({
              date: new Date(r.requested_date),
              qty: safeToNumber(r.requested_quantity),
            }));
          const filtered = local.filter((d: any) => d.date >= recentCut);
          if (!filtered.length)
            return `Insufficient historical data to predict next-week demand for '${itemName}'.`;
          // group by ISO week approx (Monday)
          const weeks: Record<string, number> = {};
          for (const row of filtered) {
            const monday = new Date(row.date);
            const day = monday.getDay(); // 0=Sun
            const diff = (day + 6) % 7;
            monday.setDate(monday.getDate() - diff);
            const key = monday.toISOString().slice(0, 10);
            weeks[key] = (weeks[key] || 0) + row.qty;
          }
          const vals = Object.values(weeks);
          if (!vals.length)
            return `Insufficient weekly aggregation data for '${itemName}'.`;
          const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
          return `Forecast: ${avg.toFixed(
            1
          )} units — based on average weekly requests over the last ${
            vals.length
          } weeks.`;
        } catch (e) {
          console.warn("Local forecast failed", e);
          return "Unable to produce a forecast due to insufficient or malformed data.";
        }
      } else {
        // No item specified -> request user to specify or offer top candidates explicitly
        return "Do you want a forecast for a specific item? Example: 'Predict next week demand for Cement in PROJECT_X'. I can also list the top candidates if you want (ask: 'which items are likely needed next week').";
      }
    }

    // ---------------- Unreturned items ----------------
    if (isUnreturned) {
      if (!projectName)
        return "Please specify the project to check unreturned items for (e.g., 'unreturned items for PROJECT_X').";
      const projReqs = (requestsDf || []).filter(
        (r: any) =>
          normalize(r.project_display || r.requested_project_name) ===
          normalize(projectName)
      );
      if (!projReqs.length)
        return `No request data for project ${projectName}.`;
      const unreturned = projReqs.filter(
        (r: any) =>
          safeToNumber(r.returned_quantity) === 0 &&
          safeToNumber(r.current_consumed_amount) === 0
      );
      if (!unreturned.length)
        return `No unreturned or unconsumed items for project ${projectName}.`;
      const withDates = unreturned
        .map((r: any) => ({
          ...r,
          relevant: r.requester_received_date || r.requested_date,
        }))
        .filter((r: any) => r.relevant)
        .sort(
          (a: any, b: any) =>
            new Date(a.relevant).getTime() - new Date(b.relevant).getTime()
        );
      const oldest = withDates[0];
      const requester = oldest.requester_name || "Unknown Requester";
      const item = oldest.item_name || "Unknown Item";
      const date = new Date(oldest.relevant).toISOString().slice(0, 10);
      const daysHeld = Math.floor(
        (Date.now() - new Date(oldest.relevant).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return `⚠️ Longest unreturned/unconsumed item:\n- ${requester} (Project: ${projectName}) requested ${item} on ${date} (${daysHeld} days ago)`;
    }

    // ---------------- Summary / Analysis ----------------
    if (isSummary) {
      // parse simple period phrases (last week, last month, last 3 months, last 6 months)
      let months = 3;
      if (/\blast\s+week\b/i.test(q)) months = 1 / 4; // approximate 1 week
      if (/\blast\s+month\b/i.test(q)) months = 1;
      if (/\blast\s+6\s+months\b/i.test(q)) months = 6;
      if (/\bthis\s+month\b/i.test(q)) months = 1; // treat as 1 month window
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - Math.max(0, Math.floor(months)));
      const period = (requestsDf || []).filter((r: any) => {
        if (!r.requested_date) return false;
        const d = new Date(r.requested_date);
        return (
          d >= cutoff &&
          (!projectName ||
            normalize(r.project_display || r.requested_project_name) ===
              normalize(projectName))
        );
      });
      if (!period.length)
        return `No data available for the requested period (last ${Math.max(
          1,
          Math.floor(months)
        )} months).`;
      const totalRequested = period.reduce(
        (s: any, r: any) => s + (safeToNumber(r.requested_quantity) || 0),
        0
      );
      const avgQty = period.length ? totalRequested / period.length : 0;
      const counts: Record<string, number> = {};
      for (const r of period)
        counts[r.item_name] = (counts[r.item_name] || 0) + 1;
      const topItems = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([i, c]) => `${i} (${c})`)
        .join(", ");

      // Try LLM summary (short)
      if (generateGeminiResponse) {
        try {
          const rows = period
            .slice(-500)
            .map(
              (r: any) =>
                `${r.project_display || r.requested_project_name || ""},${
                  r.item_name || ""
                },${r.requested_quantity || ""},${r.requested_date || ""}`
            )
            .join("\n");
          const prompt = [
            "You are a precise inventory data analyst. Only analyze the provided data.",
            "INPUT: CSV rows with columns: project_display,item_name,requested_quantity,requested_date",
            `ANALYSIS PERIOD: last ${Math.max(1, Math.floor(months))} months${
              projectName
                ? ` (filtered to project: ${projectName})`
                : " (all projects)"
            }`,
            "TASK: Create a factual summary based only on the data (max 3 lines):",
            "FORMAT:",
            "1) Total items requested and average per request (calculate from data only)",
            "2) Top 3 most requested items with exact counts from data",
            "3) One evidence-based recommendation",
            "RULES:",
            "- Use only data from the provided CSV rows",
            "- Do not make assumptions about trends unless clearly supported by data",
            "- If < 5 requests, reply exactly: INSUFFICIENT_DATA_FOR_ANALYSIS",
            "- Be precise with numbers",
            "DATA:",
            "project_display,item_name,requested_quantity,requested_date",
            rows,
          ].join("\n");
          const resp = await generateGeminiResponse(prompt);
          if (resp && !/^INSUFFICIENT_DATA_FOR_ANALYSIS|^NO_DATA/i.test(resp))
            return resp;
        } catch (e) {
          console.warn(
            "Gemini summary failed, falling back to local summary",
            e
          );
        }
      }

      // local summary fallback
      return `Summary (last ${Math.max(
        1,
        Math.floor(months)
      )} months): Total requested = ${totalRequested}, Avg per request = ${avgQty.toFixed(
        2
      )}. Top items: ${
        topItems || "No items"
      }. Recommendation: review top items and verify stock.`;
    }

    // ---------------- Project Requirements / Item Lists ----------------
    const requirementKeywords = [
      "required",
      "need",
      "needed",
      "requirements",
      "list",
      "what items",
    ];
    const isRequirementQuery =
      requirementKeywords.some((k) => q.includes(k)) && projectName;

    if (isRequirementQuery && projectName) {
      // Get items requested for this specific project
      const projectRequests = (requestsDf || []).filter(
        (r: any) =>
          normalize(r.project_display || r.requested_project_name) ===
            normalize(projectName) && r.requested_date
      );

      if (!projectRequests.length) {
        return `No request history found for project '${projectName}'. Try asking for a summary instead.`;
      }

      // Group by item and count frequency
      const itemCounts: Record<
        string,
        { count: number; totalQty: number; lastRequested: Date }
      > = {};
      for (const req of projectRequests) {
        const item = req.item_name;
        if (!item) continue;

        const qty = safeToNumber(req.requested_quantity) || 0;
        const date = new Date(req.requested_date);

        if (!itemCounts[item]) {
          itemCounts[item] = { count: 0, totalQty: 0, lastRequested: date };
        }
        itemCounts[item].count += 1;
        itemCounts[item].totalQty += qty;
        if (date > itemCounts[item].lastRequested) {
          itemCounts[item].lastRequested = date;
        }
      }

      // Sort by frequency and get top items
      const topItems = Object.entries(itemCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(
          ([item, data]) =>
            `${item} (${data.count} requests, ${
              data.totalQty
            } total units, last: ${data.lastRequested
              .toISOString()
              .slice(0, 10)})`
        )
        .join("; ");

      return `Items required for ${projectName} (based on ${projectRequests.length} total requests): ${topItems}. This shows the most frequently requested items for this project.`;
    }

    // ---------------- Item-specific fallback ----------------
    if (itemName) {
      const rows = (requestsDf || [])
        .filter(
          (r: any) =>
            normalize(r.item_name) === normalize(itemName) && r.requested_date
        )
        .map((r: any) => ({
          date: new Date(r.requested_date),
          qty: safeToNumber(r.requested_quantity),
        }));
      if (!rows.length)
        return `No historical requests found for item '${itemName}'.`;
      const total = rows.reduce((s: any, r: any) => s + r.qty, 0);
      const last = rows.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      // weekly average over last 12 weeks
      const recentCut = new Date();
      recentCut.setDate(recentCut.getDate() - 7 * 12);
      const weekly: Record<string, number> = {};
      for (const r of rows.filter((d: any) => d.date >= recentCut)) {
        const monday = new Date(r.date);
        const day = monday.getDay();
        const diff = (day + 6) % 7;
        monday.setDate(monday.getDate() - diff);
        const key = monday.toISOString().slice(0, 10);
        weekly[key] = (weekly[key] || 0) + r.qty;
      }
      const vals = Object.values(weekly);
      const recentAvg = vals.length
        ? vals.reduce((s, v) => s + v, 0) / vals.length
        : null;
      const invMatch = (inventoryDf || []).find(
        (inv: any) => normalize(inv.item_name) === normalize(itemName)
      );
      const priceText = invMatch
        ? invMatch.price || invMatch.unitPrice || invMatch.amount || null
        : null;
      let resp = `Item '${itemName}' — Total requested: ${total} units. Most recent request on ${last.date
        .toISOString()
        .slice(0, 10)}.`;
      if (priceText)
        resp += ` Unit price: ${safeToNumber(priceText).toFixed(2)} Birr.`;
      if (recentAvg !== null)
        resp += ` Recent avg weekly demand: ~${recentAvg.toFixed(
          1
        )} units (12-week).`;
      return resp;
    }

    // If nothing matched clearly, try to provide contextual help
    if (projectName && !itemName) {
      return `I detected you're asking about project '${projectName}'. Try: 'What items are required for ${projectName}', 'Summary for ${projectName}', or 'Show unreturned items for ${projectName}'.`;
    } else if (itemName && !projectName) {
      return `I detected you're asking about item '${itemName}'. Try: 'Predict next week demand for ${itemName}', 'How much ${itemName} was requested last month', or specify a project like '${itemName} for PROJECT_X'.`;
    } else {
      return "I need more specific information. Try asking about:\n• 'What items are required for [PROJECT_NAME]'\n• 'Summary for last month'\n• 'Predict next week demand for [ITEM_NAME]'\n• 'Show unreturned items for [PROJECT_NAME]'\n• 'What items are in critical state'";
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
      let botResponseText = await askChatbot(
        inputValue,
        inventoryData,
        requestsData
      );

      // Prevent repetitive responses
      if (botResponseText === lastResponse) {
        botResponseText +=
          " (Please rephrase your question if this isn't what you meant.)";
      }

      setLastResponse(botResponseText);

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
        text: "Sorry, I encountered an error processing your request.",
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
                  onKeyPress={(e) =>
                    e.key === "Enter" && !loading && handleSend()
                  }
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