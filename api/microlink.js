// api/microlink.js
import createClient from 'microlink.io';
import { trackRequest } from './turso.js'; // Import our tracking helper

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, url, query, options = {} } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Missing "type" parameter' });
  }

  // --- 1. Track the request BEFORE calling Microlink ---
  try {
    const usage = await trackRequest();
    
    if (!usage.success) {
      return res.status(429).json({ 
        error: 'Too Many Requests', 
        message: `Daily Microlink limit of ${usage.limit} reached.`,
        usage: { current: usage.current, limit: usage.limit }
      });
    }
    
    // Optional: log the usage to help you monitor
    console.log(`Microlink usage: ${usage.current}/${usage.limit}`);
    
  } catch (dbError) {
    console.error('Turso tracking failed:', dbError);
    // Decide if you want to fail open (allow request) or fail closed (block request).
    // Failing closed is safer for protecting your API quota.
    return res.status(500).json({ error: 'Internal tracking error' });
  }

  // --- 2. Proceed with Microlink request ---
  const microlink = createClient({
    apiKey: process.env.MICROLINK_API_KEY
  });

  try {
    let result;

    switch (type) {
      case 'screenshot':
        if (!url) return res.status(400).json({ error: 'Missing "url"' });
        result = await microlink.screenshot(url, options);
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
