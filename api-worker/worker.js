// Impulse Wallet Cloudflare Worker
// Endpoints:
//   POST   /room         { tz? }                       -> create a room
//   POST   /join         { roomCode, displayName }     -> join a room
//   POST   /entry        { roomCode, amount, impulse, note }
//   POST   /undo         { roomCode }                  -> undo last entry (15 min)
//   GET    /state?roomCode=...                         -> weekly state + leaderboard
//   GET    /history?roomCode=...&months=12             -> player's private history
//
// Cookie used for auth (scoped to the API path):
//   iw_pid = roomCode:player_id
//
// Requires a D1 binding named DB.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    try {
      // CORS preflight
      if (method === "OPTIONS") {
        return cors(new Response(null, { status: 204 }), request);
      }

      if (method === "POST" && path.endsWith("/room")) {
        const body = await request.json().catch(() => ({}));
        return cors(await postRoom(env, body), request);
      }
      if (method === "POST" && path.endsWith("/join")) {
        const body = await request.json().catch(() => ({}));
        return cors(await postJoin(env, request, body), request);
      }
      if (method === "POST" && path.endsWith("/entry")) {
        const body = await request.json().catch(() => ({}));
        return cors(await postEntry(env, request, body), request);
      }
      if (method === "POST" && path.endsWith("/undo")) {
        const body = await request.json().catch(() => ({}));
        return cors(await postUndo(env, request, body), request);
      }
      if (method === "GET" && path.endsWith("/state")) {
        const roomCode = url.searchParams.get("roomCode");
        return cors(await getState(env, request, roomCode), request);
      }
      if (method === "GET" && path.endsWith("/history")) {
        const roomCode = url.searchParams.get("roomCode");
        const months = url.searchParams.get("months") || "12";
        return cors(await getHistory(env, request, roomCode, months), request);
      }

      return cors(json({ error: "Not found" }, 404), request);
    } catch (e) {
      return cors(json({ error: e?.message || String(e) }, 500), request);
    }
  },
};

// --- API handlers ---

async function postRoom(env, body) {
  const room_id = crypto.randomUUID();
  const room_code = randomCode();
  const tz = body.tz || "America/Chicago";
  const created_at = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO rooms (room_id, room_code, tz, created_at) VALUES (?, ?, ?, ?)"
  ).bind(room_id, room_code, tz, created_at).run();

  return json({ roomCode: room_code });
}

async function postJoin(env, request, body) {
  const roomCode = String(body.roomCode || "").trim().toUpperCase();
  const displayName = String(body.displayName || "").trim();
  if (!roomCode || !displayName) return json({ error: "Missing" }, 400);

  const room = await getRoomByCode(env, roomCode);
  if (!room) return json({ error: "Room not found" }, 404);

  const player_id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO players (player_id, room_id, display_name, created_at) VALUES (?, ?, ?, ?)"
  ).bind(player_id, room.room_id, displayName, created_at).run();

  const cookie = [
    `iw_pid=${roomCode}:${player_id}`,
    "Path=/impulse-api",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ].join("; ");

  return new Response(JSON.stringify({ ok: true, playerId: player_id }), {
    headers: { "content-type": "application/json", "Set-Cookie": cookie },
  });
}

async function postEntry(env, request, body) {
  const { room, player_id } = await requireAuth(env, request, body.roomCode);
  const amount = Number(body.amount);
  if (![1, -1].includes(amount)) return json({ error: "Amount must be +1 or -1" }, 400);

  const entry_id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const impulse = String(body.impulse || "");
  const note = String(body.note || "");

  await env.DB.prepare(
    "INSERT INTO entries (entry_id, room_id, player_id, amount, impulse, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(entry_id, room.room_id, player_id, amount, impulse, note, created_at).run();

  return await getState(env, request, room.room_code);
}

async function postUndo(env, request, body) {
  const { room, player_id } = await requireAuth(env, request, body.roomCode);
  const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const last = await env.DB.prepare(
    `SELECT entry_id, created_at FROM entries
     WHERE room_id=? AND player_id=? AND created_at>=? AND undo_of IS NULL
     ORDER BY created_at DESC LIMIT 1`
  ).bind(room.room_id, player_id, cutoffIso).first();

  if (!last) return json({ error: "Nothing to undo" }, 400);

  await env.DB.prepare(
    "INSERT INTO entries (entry_id, room_id, player_id, amount, impulse, note, created_at, undo_of) VALUES (?, ?, ?, 0, '', 'undo', ?, ?)"
  ).bind(crypto.randomUUID(), room.room_id, player_id, new Date().toISOString(), last.entry_id).run();

  return await getState(env, request, room.room_code);
}

async function getState(env, request, roomCode) {
  const room = await getRoomByCode(env, roomCode);
  if (!room) return json({ error: "Room not found" }, 404);

  const cookies = parseCookies(request);
  const [cookieRoomCode, player_id] = (cookies.iw_pid || "").split(":");
  if (!player_id || cookieRoomCode !== room.room_code) return json({ error: "Join required" }, 401);

  const week = currentCtWeek();
  const rows = await env.DB.prepare(
    `SELECT player_id, amount, created_at FROM entries
     WHERE room_id=? AND created_at>=? AND created_at<?`
  ).bind(room.room_id, week.startIso, week.endIso).all();

  const byPlayer = {};
  for (const r of rows.results) {
    if (!byPlayer[r.player_id]) {
      byPlayer[r.player_id] = { balance: 0, deposits: 0, total: 0, streak: 0, longest: 0 };
    }
    const rec = byPlayer[r.player_id];
    const amt = Number(r.amount);
    if (amt === 1) {
      rec.balance++;
      rec.deposits++;
      rec.total++;
      rec.streak++;
      if (rec.streak > rec.longest) rec.longest = rec.streak;
    } else if (amt === -1) {
      rec.balance--;
      rec.total++;
      rec.streak = 0;
    } else {
      rec.total++;
      rec.streak = 0;
    }
  }

  const leaderboard = [];
  for (const pid of Object.keys(byPlayer)) {
    const pl = await env.DB.prepare("SELECT display_name FROM players WHERE player_id=?").bind(pid).first();
    const rec = byPlayer[pid];
    leaderboard.push({
      playerId: pid,
      name: pl ? pl.display_name : pid,
      balance: rec.balance,
      depositRate: rec.total ? rec.deposits / rec.total : 0,
      longestStreak: rec.longest,
    });
  }
  leaderboard.sort((a, b) =>
    b.balance - a.balance || b.depositRate - a.depositRate || b.longestStreak - a.longestStreak
  );

  const me = byPlayer[player_id] || { balance: 0, deposits: 0, total: 0, streak: 0, longest: 0 };
  let milestone = "none";
  if (me.balance >= 20) milestone = "win";
  else if (me.balance <= -20) milestone = "loss";

  return json({
    weekKey: week.weekKey,
    startIso: week.startIso,
    endIso: week.endIso,
    milestone,
    me,
    leaderboard,
  });
}

async function getHistory(env, request, roomCode, months) {
  const { room, player_id } = await requireAuth(env, request, roomCode);
  const since = new Date();
  since.setMonth(since.getMonth() - Math.max(1, Math.min(24, Number(months) || 12)));
  const sinceIso = since.toISOString();

  const rows = await env.DB.prepare(
    `SELECT amount, impulse, note, created_at, undo_of
     FROM entries WHERE room_id=? AND player_id=? AND created_at>=? ORDER BY created_at DESC`
  ).bind(room.room_id, player_id, sinceIso).all();

  return json({ entries: rows.results });
}

// --- helpers ---

async function getRoomByCode(env, code) {
  return await env.DB.prepare("SELECT * FROM rooms WHERE room_code=?").bind(code).first();
}

async function requireAuth(env, request, roomCode) {
  const room = await getRoomByCode(env, roomCode);
  if (!room) throw new Error("Room not found");
  const cookies = parseCookies(request);
  const [cookieRoomCode, player_id] = (cookies.iw_pid || "").split(":");
  if (!player_id || cookieRoomCode !== room.room_code) throw new Error("Join required");
  return { room, player_id };
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const pairs = header.split(/; */).map((c) => c.split("="));
  const out = {};
  for (const [k, v] of pairs) if (k && v) out[k.trim()] = decodeURIComponent(v);
  return out;
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function currentCtWeek() {
  const now = new Date();
  const nowCt = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const day = nowCt.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = (day + 6) % 7;
  const mondayCt = new Date(nowCt);
  mondayCt.setDate(nowCt.getDate() - diffToMonday);
  mondayCt.setHours(0, 1, 0, 0);
  const startIso = mondayCt.toISOString();
  const endCt = new Date(mondayCt);
  endCt.setDate(mondayCt.getDate() + 7);
  const endIso = endCt.toISOString();
  const weekKey = mondayCt.toISOString().substring(0, 10);
  return { weekKey, startIso, endIso };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cors(resp, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([
    "https://themoderncompass.io",
    "https://impulsewallet.themoderncompass.io",
  ]);
  const h = new Headers(resp.headers);
  if (allowed.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Vary", "Origin");
  }
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  return new Response(resp.body, { status: resp.status, headers: h });
}
