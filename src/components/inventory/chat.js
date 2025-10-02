
const genai = require('@google/generative-ai');

exports.handler = async (event) => {
  try {
    const client = genai.Client({ apiKey: process.env.GEMINI_API_KEY });
    const { prompt } = JSON.parse(event.body || '{}');
    const response = await client.models.generate_content({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    const text = response?.text || response?.output?.[0]?.content?.[0]?.text || '';
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ text }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to process chat request' }),
    };
  }
};
