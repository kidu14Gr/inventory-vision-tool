const ML_API_URL = (import.meta.env.MODE === 'development') ? '/ml' : import.meta.env.VITE_ML_API_URL;

export interface PredictionInput {
  project_name: string;
  item_name: string;
  requested_date: string; // ISO format: YYYY-MM-DD
  in_use: number; // 0 or 1
}

export interface PredictionResponse {
  predicted_quantity: number;
}

export async function predictDemand(input: PredictionInput): Promise<number> {
  try {
    const url = `${ML_API_URL.replace(/\/$/, '')}/predict`;
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(input),
    });

    const rawText = await response.text();
    if (!response.ok) {
      // include body in error for easier debugging
      throw new Error(`ML API error: ${response.status} ${response.statusText} - ${rawText}`);
    }

    // Try to parse JSON if possible
    let data: any;
    try {
      data = rawText ? JSON.parse(rawText) : undefined;
    } catch (e) {
      // not JSON, maybe plain number
      const num = Number(rawText);
      if (!Number.isNaN(num)) return num;
      throw new Error(`ML API returned non-JSON and non-numeric response: ${rawText}`);
    }

    // Accept several possible response shapes
    if (typeof data === 'number') return data;
    if (data == null) throw new Error('ML API returned empty body');
    const candidates = [
      data.predicted_quantity,
      data.prediction,
      data.predicted,
      data.value,
      data.result,
      data.output
    ];
    for (const c of candidates) {
      if (typeof c === 'number' && !Number.isNaN(c)) return c;
      if (typeof c === 'string' && !Number.isNaN(Number(c))) return Number(c);
    }

    // If data is an object with nested numeric fields, try to find the first numeric value
    const findFirstNumber = (obj: any): number | null => {
      if (obj == null) return null;
      if (typeof obj === 'number' && !Number.isNaN(obj)) return obj;
      if (typeof obj === 'string' && !Number.isNaN(Number(obj))) return Number(obj);
      if (Array.isArray(obj)) {
        for (const v of obj) {
          const found = findFirstNumber(v);
          if (found != null) return found;
        }
      } else if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
          const found = findFirstNumber(obj[k]);
          if (found != null) return found;
        }
      }
      return null;
    };

    const fallback = findFirstNumber(data);
    if (fallback != null) return fallback;

    throw new Error(`Unable to extract numeric prediction from ML API response: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('Error predicting demand:', error);
    throw error;
  }
}

export async function checkMlApi(): Promise<{ ok: boolean; status?: number; error?: string }>{
  const base = ML_API_URL.replace(/\/$/, '');
  const candidates = [
    { path: '/health', method: 'GET' },
    { path: '/openapi.json', method: 'GET' },
    { path: '/', method: 'GET' }
  ];
  let lastErr: any = null;
  for (const c of candidates) {
    try {
      const url = `${base}${c.path}`;
      const resp = await fetch(url, { method: c.method as any, mode: 'cors' });
      if (resp.ok) return { ok: true, status: resp.status, error: `checked ${c.path}` } as any;
      lastErr = { ok: false, status: resp.status, error: `checked ${c.path}` };
    } catch (err: any) {
      lastErr = err;
    }
  }
  return { ok: false, error: (lastErr && (lastErr.error || lastErr.message)) || String(lastErr) };
}