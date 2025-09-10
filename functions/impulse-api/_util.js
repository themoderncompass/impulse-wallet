export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization"
    }
  });
}

// Enhanced UPSERT helper for consistent database operations
export async function upsertWithRetry(env, query, bindings, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await env.DB.prepare(query).bind(...bindings).run();
      return result;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Handle common SQLite concurrency issues
      const msg = error.message.toLowerCase();
      if (msg.includes('locked') || msg.includes('busy') || msg.includes('constraint')) {
        // Exponential backoff: 10ms, 40ms, 160ms
        await new Promise(resolve => setTimeout(resolve, 10 * Math.pow(4, attempt - 1)));
        continue;
      }
      throw error;
    }
  }
}

// Event logging helper - will be used across all endpoints
export async function logEvent(env, eventType, data = {}) {
  try {
    const event = {
      type: eventType,
      data: data,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID()
    };
    
    await upsertWithRetry(env, `
      INSERT INTO events (id, type, data, created_at)
      VALUES (?, ?, ?, ?)
    `, [event.id, eventType, JSON.stringify(data), event.timestamp]);
    
    return event;
  } catch (error) {
    console.error('Event logging failed:', error);
    // Don't fail the main operation if logging fails
    return null;
  }
}
