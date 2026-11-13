// api/microlink.js
import createClient from 'microlink.io';
import { 
  trackRequest, 
  findRecentScreenshot, 
  saveScreenshot, 
  logUsage 
} from './turso.js';

export default async function handler(req, res) {
  // --- CORS Headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { 
  type, 
  url, 
  query, 
  options = {}, 
  viewport = null, 
  meta = true, 
  adblock = true, 
  force = false 
} = req.body;
  if (!type) return res.status(400).json({ error: 'Missing "type" parameter' });

  const microlink = createClient({
    apiKey: process.env.MICROLINK_API_KEY
  });

  // Reusable rate-limit response
  const tooManyRequests = (usage) => res.status(429).json({
    error: 'Too Many Requests',
    message: `Daily Microlink limit of ${usage.limit} reached.`,
    usage: { current: usage.current, limit: usage.limit }
  });

  try {
    let result;

    switch (type) {
      // ==========================================
      // SCREENSHOT — cache-first, no counter on hit
      // ==========================================
      case 'screenshot': {
        if (!url) return res.status(400).json({ error: 'Missing "url"' });

        // 1. Cache check FIRST — no counter increment
        const cached = await findRecentScreenshot(url, 60);
        if (cached) {
          await logUsage({ type: 'screenshot', sourceUrl: url, status: 200, cached: true });
          return res.status(200).json({ ...cached, cached: true });
        }

        // 2. Cache miss — check/increment daily limit
        const usage = await trackRequest();
        if (!usage.success) return tooManyRequests(usage);

        // 3. Fetch from Microlink
        try {
          result = await microlink.screenshot(url, {
  ...options,
  ...(viewport && { viewport }),
  meta,
  adblock,
  force
});
          await logUsage({ type: 'screenshot', sourceUrl: url, status: 200, cached: false });
          await saveScreenshot(url, result);
        } catch (error) {
          await logUsage({ type: 'screenshot', sourceUrl: url, status: 500, cached: false });
          throw error;
        }
        break;
      }

      // ==========================================
      // SEARCH — always hits Microlink
      // ==========================================
      case 'search': {
        if (!query) return res.status(400).json({ error: 'Missing "query"' });

        const usage = await trackRequest();
        if (!usage.success) return tooManyRequests(usage);

        try {
          result = await microlink.search(query);
          await logUsage({ type: 'search', status: 200, cached: false });
        } catch (error) {
          await logUsage({ type: 'search', status: 500, cached: false });
          throw error;
        }
        break;
      }

      // ==========================================
      // HTML — always hits Microlink
      // ==========================================
      case 'html': {
        if (!url) return res.status(400).json({ error: 'Missing "url"' });

        const usage = await trackRequest();
        if (!usage.success) return tooManyRequests(usage);

        try {
          result = await microlink.html(url, options);
          await logUsage({ type: 'html', sourceUrl: url, status: 200, cached: false });
        } catch (error) {
          await logUsage({ type: 'html', sourceUrl: url, status: 500, cached: false });
          throw error;
        }
        break;
      }

      // ==========================================
      // IMAGES — always hits Microlink
      // ==========================================
      case 'images': {
        if (!url) return res.status(400).json({ error: 'Missing "url"' });

        const usage = await trackRequest();
        if (!usage.success) return tooManyRequests(usage);

        try {
          result = await microlink.images(url, options);
          await logUsage({ type: 'images', sourceUrl: url, status: 200, cached: false });
        } catch (error) {
          await logUsage({ type: 'images', sourceUrl: url, status: 500, cached: false });
          throw error;
        }
        break;
      }

      // ==========================================
      // METADATA — always hits Microlink
      // ==========================================
      case 'metadata': {
        if (!url) return res.status(400).json({ error: 'Missing "url"' });

        const usage = await trackRequest();
        if (!usage.success) return tooManyRequests(usage);

        try {
          result = await microlink.metadata(url, options);
          await logUsage({ type: 'metadata', sourceUrl: url, status: 200, cached: false });
        } catch (error) {
          await logUsage({ type: 'metadata', sourceUrl: url, status: 500, cached: false });
          throw error;
        }
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported type: ${type}` });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Microlink API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
