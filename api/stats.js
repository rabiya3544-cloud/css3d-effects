// api/stats.js
import { createClient } from "@tursodatabase/serverless/compat";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [today, cacheRate, topUrls, failures] = await Promise.all([
      client.execute('SELECT * FROM view_requests_today'),
      client.execute('SELECT * FROM view_cache_hit_rate_7d'),
      client.execute('SELECT * FROM view_top_urls'),
      client.execute('SELECT * FROM view_failed_requests LIMIT 10'),
    ]);

    return res.status(200).json({
      today: today.rows,
      cacheRate: cacheRate.rows,
      topUrls: topUrls.rows,
      failures: failures.rows,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
