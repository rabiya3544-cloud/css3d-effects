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
    return res.status(200).json({
      ...cached,
      cached: true  // Flag so frontend knows this came from cache
    });
  }
  
  // 2. Not cached — call Microlink
  result = await microlink.screenshot(url, options);
  
  // 3. Save for future requests
  await saveScreenshot(url, result);
  break;
      case 'search':
        if (!query) return res.status(400).json({ error: 'Missing "query"' });
        result = await microlink.search(query);
        break;
      case 'html':
        if (!url) return res.status(400).json({ error: 'Missing "url"' });
        result = await microlink.html(url, options);
        break;
      case 'images':
        if (!url) return res.status(400).json({ error: 'Missing "url"' });
        result = await microlink.images(url, options);
        break;
      case 'metadata':
        if (!url) return res.status(400).json({ error: 'Missing "url"' });
        result = await microlink.metadata(url, options);
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
