import { createClient } from "@tursodatabase/serverless/compat";

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
  const today = getTodayUTC();

  // Atomic: increment only if count < LIMIT, otherwise return null
  const result = await client.execute({
    sql: `
      INSERT INTO daily_usage (date, count)
      VALUES (?, 1)
      ON CONFLICT(date) DO UPDATE SET
        count = count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE count < ?
      RETURNING count
    `,
    args: [today, DAILY_LIMIT],
  });

  if (result.rows.length === 0) {
    // No row returned = WHERE clause blocked the increment = limit hit
    const current = await checkUsage();
    return { success: false, reason: 'Daily limit reached', current: current.current, limit: DAILY_LIMIT };
  }

  return { success: true, current: result.rows[0].count, limit: DAILY_LIMIT };
}
// Add to api/turso.js
export async function findRecentScreenshot(sourceUrl, maxAgeMinutes = 60) {
  const result = await client.execute({
    sql: `
      SELECT 
        image_url AS url,
        type,
        width,
        height,
        size,
        size_pretty,
        created_at
      FROM screenshots
      WHERE source_url = ?
        AND created_at >= datetime('now', '-' || ? || ' minutes')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [sourceUrl, maxAgeMinutes]
  });
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function saveScreenshot(sourceUrl, data) {
  const result = await client.execute({
    sql: `
      INSERT INTO screenshots (source_url, image_url, type, width, height, size, size_pretty)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    args: [
      sourceUrl,
      data.url,
      data.type || 'png',
      data.width || null,
      data.height || null,
      data.size || null,
      data.size_pretty || null
    ]
  });
  
  return result.rows[0].id;
}

// Add to api/turso.js
export async function logUsage({ type, sourceUrl = null, status, cached = false }) {
  try {
    await client.execute({
      sql: `
        INSERT INTO usage_log (type, source_url, status, cached)
        VALUES (?, ?, ?, ?)
      `,
      args: [type, sourceUrl, status, cached ? 1 : 0]
    });
  } catch (error) {
    // Logging should never break the main request
    console.error('Failed to log usage:', error);
  }
}
