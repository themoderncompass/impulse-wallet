import { json, logEvent } from "./_util.js";

const up = (s) => (s || "").trim().toUpperCase();

// Generate room code suggestions
function generateRoomSuggestions(baseName = "", count = 5) {
  const suggestions = [];
  const base = baseName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) || 'ROOM';
  
  // Common patterns for room codes
  const patterns = [
    // Based on base name
    () => base + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    () => base.substring(0, 4) + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
    
    // Fun/memorable patterns
    () => generateWordCombination(),
    () => generateDateBased(),
    () => generateRandomCode(6),
  ];
  
  for (let i = 0; i < count && suggestions.length < count; i++) {
    const pattern = patterns[i % patterns.length];
    const suggestion = pattern();
    if (!suggestions.includes(suggestion) && suggestion.length >= 3 && suggestion.length <= 12) {
      suggestions.push(suggestion);
    }
  }
  
  return suggestions;
}

function generateWordCombination() {
  const words1 = ['FOCUS', 'STUDY', 'WORK', 'TEAM', 'SQUAD', 'GUILD', 'CREW'];
  const words2 = ['ZONE', 'HUB', 'LAB', 'ROOM', 'BASE', 'DEN', 'CAVE'];
  const word1 = words1[Math.floor(Math.random() * words1.length)];
  const word2 = words2[Math.floor(Math.random() * words2.length)];
  const num = Math.floor(Math.random() * 100);
  return `${word1}${word2}${num}`;
}

function generateDateBased() {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  return `ROOM${month}${day}${hour}`;
}

function generateRandomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Ensure rooms table exists
async function ensureRoomsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

// Check if room codes are available
async function checkAvailability(env, roomCodes) {
  if (!roomCodes.length) return [];
  
  await ensureRoomsTable(env);
  
  const placeholders = roomCodes.map(() => '?').join(',');
  const query = `SELECT code FROM rooms WHERE code IN (${placeholders})`;
  const result = await env.DB.prepare(query).bind(...roomCodes).all();
  const taken = new Set((result.results || []).map(r => r.code));
  
  return roomCodes.map(code => ({
    code,
    available: !taken.has(code)
  }));
}

// GET /impulse-api/room-suggestions?baseName=MyTeam&count=5
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const baseName = url.searchParams.get('baseName') || '';
    const count = Math.min(parseInt(url.searchParams.get('count')) || 5, 10);
    
    const suggestions = generateRoomSuggestions(baseName, count * 2); // Generate extra to account for collisions
    const availability = await checkAvailability(env, suggestions);
    
    // Return only available suggestions, up to the requested count
    const available = availability.filter(item => item.available).slice(0, count);
    
    // Log suggestion request
    await logEvent(env, 'room_suggestions_requested', {
      baseName,
      requestedCount: count,
      generatedCount: suggestions.length,
      availableCount: available.length
    });
    
    return json({ 
      ok: true, 
      suggestions: available.map(item => item.code),
      baseName,
      count: available.length
    });
    
  } catch (error) {
    console.error('Room suggestions error:', error);
    return json({ error: error.message || 'Failed to generate room suggestions' }, 500);
  }
}

// POST /impulse-api/room-suggestions - Check specific room codes for availability
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { roomCodes = [] } = body;
    
    if (!Array.isArray(roomCodes) || roomCodes.length === 0) {
      return json({ error: 'roomCodes array is required' }, 400);
    }
    
    if (roomCodes.length > 20) {
      return json({ error: 'Maximum 20 room codes can be checked at once' }, 400);
    }
    
    // Normalize and validate room codes
    const normalizedCodes = roomCodes.map(code => up(code)).filter(code => {
      return code.length >= 3 && code.length <= 12 && /^[A-Z0-9]+$/.test(code);
    });
    
    const availability = await checkAvailability(env, normalizedCodes);
    
    await logEvent(env, 'room_availability_checked', {
      requestedCount: roomCodes.length,
      validCount: normalizedCodes.length,
      availableCount: availability.filter(item => item.available).length
    });
    
    return json({ 
      ok: true, 
      results: availability
    });
    
  } catch (error) {
    console.error('Room availability check error:', error);
    return json({ error: error.message || 'Failed to check room availability' }, 500);
  }
}