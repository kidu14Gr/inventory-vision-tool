const KAFKA_API_URL = (import.meta.env.MODE === 'development') ? '/kafka' : import.meta.env.VITE_KAFKA_API_URL;

export interface ConsumeRequest {
  topic: string;
  group_id: string;
  auto_offset_reset: string;
  limit: number;
}

export interface ConsumeResponse {
  count: number;
  messages: any[];
}

export async function consumeKafkaTopic(
  topic: string,
  groupId: string = `scm_react_${Date.now()}`,
  limit: number = 5000,
  autoOffsetReset: string = 'earliest'
): Promise<any[]> {
  try {
    const payload: ConsumeRequest = {
      topic,
      group_id: groupId,
      auto_offset_reset: autoOffsetReset,
      limit,
    };

    // Use CORS mode to make requirements explicit for browser requests.
    const response = await fetch(`${KAFKA_API_URL.replace(/\/$/, '')}/consume`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Kafka API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    // Debug: expose raw response shape in console to help diagnose missing data
    try {
      console.debug('Kafka API raw response:', data);
    } catch (e) {
      // ignore
    }

    // Support multiple possible response shapes. Expected: { count, messages: [{ value: ... }, ...] }
    if (Array.isArray(data)) {
      // If the API returned an array directly, assume it's the messages
      return data;
    }

    if (data && Array.isArray(data.messages)) {
      return data.messages.map((msg: any) => (msg && msg.value !== undefined ? msg.value : msg));
    }

    // If the response contains a `value` directly or an object, return it as single-element array
    if (data && data.value !== undefined) {
      return [data.value];
    }

    // Unknown shape — return empty array to avoid throwing where upstream expects an array
    return [];
  } catch (error) {
    console.error('Error consuming Kafka topic:', error);
    throw error;
  }
}

// Lightweight helper to check whether the Kafka API is reachable from the browser
// and whether the server is allowing cross-origin requests. Returns an object
// with { ok, status, corsBlocked, error }
export async function checkKafkaApi(): Promise<{ ok: boolean; status?: number; corsBlocked?: boolean; error?: string }>{
  try {
    // Send a minimal consume request with small limit so the server can respond quickly
    const testPayload = { topic: 'scm_requests', group_id: `scm_check_${Date.now()}`, auto_offset_reset: 'latest', limit: 1 };
    const resp = await fetch(`${KAFKA_API_URL.replace(/\/$/, '')}/consume`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    return { ok: resp.ok, status: resp.status };
  } catch (err: any) {
    // A TypeError thrown by fetch in the browser often indicates a CORS block
    const message = err?.message || String(err);
    const corsBlocked = message && (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror') || message.toLowerCase().includes('typeerror'));
    return { ok: false, corsBlocked, error: message };
  }
}