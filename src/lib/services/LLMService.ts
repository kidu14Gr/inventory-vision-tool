// OpenRouter API configuration for NVIDIA Nemotron
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = '/.netlify/functions/openrouter';
const MODEL_NAME = 'meta-llama/llama-3.3-70b-instruct:free';

if (!OPENROUTER_API_KEY) {
  console.error('VITE_OPENROUTER_API_KEY is not set in environment variables');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateGeminiResponse(prompt: string, maxRetries = 3): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured. Please set VITE_OPENROUTER_API_KEY in your .env file.');
  }

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Calling OpenRouter API with model: ${MODEL_NAME} (attempt ${attempt + 1}/${maxRetries})`);

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Inventory Vision Tool',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const content = data.choices[0].message.content;
        if (content && content.trim()) {
          return content.trim();
        }
      }

      throw new Error('Invalid response format from API');

    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error with OpenRouter API (attempt ${attempt + 1}/${maxRetries}):`, error);

      // Check for rate limit errors (429)
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        const retryDelay = Math.pow(2, attempt) * 2000;
        
        if (attempt < maxRetries - 1) {
          console.log(`Rate limit exceeded. Waiting ${retryDelay / 1000}s before retry...`);
          await sleep(retryDelay);
          continue;
        } else {
          throw new Error('API rate limit exceeded. Please wait a few minutes and try again.');
        }
      }

      // Check for quota errors
      if (errorMessage.includes('quota') || errorMessage.includes('credits')) {
        throw new Error('API quota exceeded. Please check your OpenRouter account.');
      }

      // For 503 (service unavailable) errors
      if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
        if (attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`Service unavailable, retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          continue;
        }
      }

      // For network errors
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
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

export async function checkGeminiService(): Promise<{ ok: boolean; message: string }> {
  try {
    const testResponse = await generateGeminiResponse('Reply with only: OK');
    return {
      ok: true,
      message: `OpenRouter (NVIDIA Nemotron) service operational. Test: ${testResponse.substring(0, 50)}`,
    };
  } catch (error) {
    console.error('OpenRouter service check failed:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Service check failed',
    };
  }
}