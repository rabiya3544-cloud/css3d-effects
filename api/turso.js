// api/turso.js
import { createClient } from '@libsql/client';

// Initialize the client outside the handler to reuse the connection
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const DAILY_LIMIT = 25;

// Helper to get today's date string (YYYY-MM-DD) in UTC
function getTodayUTC() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Checks if today's usage has reached the limit.
 * Returns { allowed: boolean, current: number, limit: number }
 */
export async function checkUsage() {
  const today = getTodayUTC();
  
  const result = await client.execute({
    sql: 'SELECT count FROM daily_usage WHERE date = ?',
    args: [today],
  });

  const currentCount = result.rows.length > 0 ? result.rows[0].count : 0;
  
  return {
    allowed: currentCount < DAILY_LIMIT,
    current: currentCount,
    limit: DAILY_LIMIT,
  };
}

/**
 * Atomically increments the count for today.
 * Uses UPSERT to handle the first request of the day.
 * Returns the new total count.
 */
export async function incrementUsage() {
  const today = getTodayUTC();

  // The ON CONFLICT clause ensures we add 1 to the existing count, or start at 1
  const result = await client.execute({
    sql: `
      INSERT INTO daily_usage (date, count) 
      VALUES (?, 1) 
      ON CONFLICT(date) DO UPDATE SET 
        count = count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING count
    `,
    args: [today],
  });

  // The RETURNING clause gives us the new count immediately
  return result.rows[0].count;
}

/**
 * Convenience wrapper: Checks limit, increments if allowed, returns status.
 */
export async function trackRequest() {
  const status = await checkUsage();
  
  if (!status.allowed) {
    return { success: false, reason: 'Daily limit reached', current: status.current, limit: DAILY_LIMIT };
  }

  const newCount = await incrementUsage();
  return { success: true, current: newCount, limit: DAILY_LIMIT };
}
