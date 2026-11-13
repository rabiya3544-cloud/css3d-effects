// api/microlink.js
import createClient from 'microlink.io';
import { trackRequest } from './turso.js';

export default async function handler(req, res) {
  // --- CORS Headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, url, query, options = {} } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Missing "type" parameter' });
  }

  try {
    const usage = await trackRequest();
    if (!usage.success) {
      return res.status(429).json({ 
        error: 'Too Many Requests', 
        message: `Daily Microlink limit of ${usage.limit} reached.`,
        usage: { current: usage.current, limit: usage.limit }
      });
    }
  } catch (dbError) {
    console.error('Turso tracking failed:', dbError);
    return res.status(500).json({ error: 'Internal tracking error' });
  }

  const microlink = createClient({
    apiKey: process.env.MICROLINK_API_KEY
  });

  try {
    let result;
    switch (type) {
      case 'screenshot':
        if (!url) return res.status(400).json({ error: 'Missing "url"' });

        // 1. Check cache first (doesn't consume a Microlink request)
        const cached = await findRecentScreenshot(url, 60); // 60-minute TTL
        if (cached) {
          // Log the cache hit
          await logUsage({ type: 'screenshot', sourceUrl: url, status: 200, cached: true });
          
          return res.status(200).json({
            ...cached,
            cached: true  // Flag so frontend knows this came from cache
          });
        }

        // 2. Not cached — call Microlink
        try {
          result = await microlink.screenshot(url, options);
          
          // Log the successful API call
          await logUsage({ type: 'screenshot', sourceUrl: url, status: 200, cached: false });
          
          // 3. Save for future requests
          await saveScreenshot(url, result);
          
        } catch (error) {
          // Log the failed API call (e.g., if the URL is invalid or times out)
          await logUsage({ type: 'screenshot', sourceUrl: url, status: 500, cached: false });
          
          // Re-throw the error so the main try/catch block catches it and returns a 500 to the frontend
          throw error; 
        }
        break;
      case 'search':
  if (!query) return res.status(400).json({ error: 'Missing "query"' });
  result = await microlink.search(query);
  await logUsage({ type: 'search', status: 200, cached: false });
  break;

case 'html':
  if (!url) return res.status(400).json({ error: 'Missing "url"' });
  result = await microlink.html(url, options);
  await logUsage({ type: 'html', sourceUrl: url, status: 200, cached: false });
  break;

case 'images':
  if (!url) return res.status(400).json({ error: 'Missing "url"' });
  result = await microlink.images(url, options);
  await logUsage({ type: 'images', sourceUrl: url, status: 200, cached: false });
  break;

case 'metadata':
  if (!url) return res.status(400).json({ error: 'Missing "url"' });
  result = await microlink.metadata(url, options);
  await logUsage({ type: 'metadata', sourceUrl: url, status: 200, cached: false });
  break;
      default:
        return res.status(400).json({ error: `Unsupported type: ${type}` });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Microlink API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
