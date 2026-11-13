// api/usage.js
import { checkUsage } from './turso.js';

export default async function handler(req, res) {
  // --- CORS Headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = await checkUsage();
    return res.status(200).json(status);
  } catch (error) {
    console.error('Turso usage check failed:', error);
    return res.status(500).json({ 
      error: 'Failed to check database usage',
      details: error.message 
    });
  }
}
