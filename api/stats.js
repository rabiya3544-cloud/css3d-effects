// api/stats.js
import { client } from './turso.js';

export default async function handler(req, res) {
  // --- CORS Headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // --- Short cache: CDN serves for 30s, revalidates in background ---
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [today, cacheRate, topUrls, failures, dailyUsage] = await Promise.all([
      client.execute('SELECT * FROM view_requests_today'),
      client.execute('SELECT * FROM view_cache_hit_rate_7d'),
      client.execute('SELECT * FROM view_top_urls'),
      client.execute('SELECT * FROM view_failed_requests LIMIT 10'),
      client.execute("SELECT count FROM daily_usage WHERE date = date('now')"),
    ]);

    return res.status(200).json({
      today: today.rows,
      cacheRate: cacheRate.rows,
      topUrls: topUrls.rows,
      failures: failures.rows,
      dailyUsage: {
        current: dailyUsage.rows[0]?.count || 0,
        limit: 25,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
