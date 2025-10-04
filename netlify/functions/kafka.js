exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Allow POST for consume, GET for health checks
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'GET, POST',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Determine the target URL based on method
    let targetUrl;
    let fetchOptions = {};

    if (event.httpMethod === 'POST') {
      const { body } = event;
      const payload = JSON.parse(body);
      targetUrl = 'https://kafka-api.ienetworks.co/consume';
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      };
    } else if (event.httpMethod === 'GET') {
      // For GET, forward the path
      const path = event.path.replace(/^\/\.netlify\/functions\/kafka/, '') || '/';
      targetUrl = 'https://kafka-api.ienetworks.co' + path;
      fetchOptions = {
        method: 'GET',
      };
    }

    // Forward the request to the actual Kafka API
    const response = await fetch(targetUrl, fetchOptions);

    const responseBody = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: responseBody,
    };
  } catch (error) {
    console.error('Error proxying Kafka API:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};