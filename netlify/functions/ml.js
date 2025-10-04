exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Allow POST for predict, GET for health checks
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Allow': 'GET, POST',
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
      targetUrl = 'https://fastapi.ienetworks.co/predict';
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      };
    } else if (event.httpMethod === 'GET') {
      // For GET, forward the path
      const path = event.path.replace(/^\/\.netlify\/functions\/ml/, '') || '/';
      targetUrl = 'https://fastapi.ienetworks.co' + path;
      fetchOptions = {
        method: 'GET',
      };
    }

    // Forward the request to the actual ML API
    const response = await fetch(targetUrl, fetchOptions);

    const responseBody = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: responseBody,
    };
  } catch (error) {
    console.error('Error proxying ML API:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};