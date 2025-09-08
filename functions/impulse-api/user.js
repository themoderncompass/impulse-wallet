// Create: functions/impulse-api/user.js

// Local json helper
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function ensureUserTable(env) {
  // Create users table if it doesn't exist
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

// POST /impulse-api/user - Create or update user record
export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { userId, displayName, email } = payload;

    if (!userId || typeof userId !== 'string') {
      return json({ error: 'userId required' }, 400);
    }

    await ensureUserTable(env);

    // Use UPSERT (INSERT OR REPLACE) to handle existing users
    const result = await env.DB.prepare(`
      INSERT INTO users (id, email, display_name, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        email = COALESCE(excluded.email, email),
        display_name = COALESCE(excluded.display_name, display_name),
        updated_at = datetime('now')
    `).bind(userId, email, displayName).run();

    return json({
      userId,
      email,
      displayName,
      created: result.changes > 0
    }, result.changes > 0 ? 201 : 200);

  } catch (error) {
    console.error('User creation error:', error);
    return json({ error: error.message || 'Internal server error' }, 500);
  }
}

// GET /impulse-api/user?userId=xxx - Get user info
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return json({ error: 'userId required' }, 400);
    }

    await ensureUserTable(env);

    const user = await env.DB.prepare(
      'SELECT id, email, display_name, created_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    return json({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at
    });

  } catch (error) {
    console.error('User fetch error:', error);
    return json({ error: error.message || 'Internal server error' }, 500);
  }
}