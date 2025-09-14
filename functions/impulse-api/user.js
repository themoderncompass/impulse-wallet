// Create: functions/impulse-api/user.js
import { json, upsertWithRetry, logEvent } from "./_util.js";

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

    // Use UPSERT with retry logic to handle existing users
    const result = await upsertWithRetry(env, `
      INSERT INTO users (id, email, display_name, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        email = COALESCE(excluded.email, email),
        display_name = COALESCE(excluded.display_name, display_name),
        updated_at = datetime('now')
    `, [userId, email || null, displayName || null]);
    
    // Log user creation/update event
    await logEvent(env, 'user_upserted', {
      userId,
      email: email ? '[redacted]' : null, // Don't log actual email for privacy
      displayName,
      isNewUser: result.changes > 0
    });

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
      'SELECT id, email, display_name, onboarding_completed, onboarding_completed_at, created_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    return json({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      onboardingCompleted: !!user.onboarding_completed,
      onboardingCompletedAt: user.onboarding_completed_at,
      createdAt: user.created_at
    });

  } catch (error) {
    console.error('User fetch error:', error);
    return json({ error: error.message || 'Internal server error' }, 500);
  }
}

// PATCH /impulse-api/user - Update user onboarding completion
export async function onRequestPatch({ request, env }) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { userId, onboardingCompleted } = payload;

    if (!userId || typeof userId !== 'string') {
      return json({ error: 'userId required' }, 400);
    }

    if (typeof onboardingCompleted !== 'boolean') {
      return json({ error: 'onboardingCompleted boolean required' }, 400);
    }

    await ensureUserTable(env);

    // Check if user exists
    const user = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    // Update onboarding status
    await env.DB.prepare(`
      UPDATE users 
      SET onboarding_completed = ?, 
          onboarding_completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(onboardingCompleted ? 1 : 0, onboardingCompleted ? 1 : 0, userId).run();

    // Log onboarding completion event
    if (onboardingCompleted) {
      await logEvent(env, 'onboarding_completed', {
        userId
      });
    }

    return json({
      userId,
      onboardingCompleted,
      updated: true
    });

  } catch (error) {
    console.error('User update error:', error);
    return json({ error: error.message || 'Internal server error' }, 500);
  }
}