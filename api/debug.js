// api/usage.js
import { checkUsage, client } from './turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const status = await checkUsage();
    const all = await client.execute('SELECT * FROM daily_usage');
    return res.status(200).json({
      ...status,
      _debug: {
        rowsVisibleToApi: all.rows,
        rowCount: all.rows.length,
        dbHostTail: (process.env.TURSO_DATABASE_URL || '').split('?')[0].slice(-30)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message, details: error.message });
  }
}
