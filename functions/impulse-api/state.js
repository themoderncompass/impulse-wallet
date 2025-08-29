export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const roomCode = url.searchParams.get("roomCode");
  if (!roomCode) return Response.json({ error: "roomCode required" }, { status: 400 });

  const state = await env.DB.prepare(
    "SELECT state_json, updated_at FROM room_state WHERE room_code = ? ORDER BY updated_at DESC LIMIT 1"
  ).bind(roomCode).first();

  if (!state) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json({ ok: true, roomCode, state: JSON.parse(state.state_json) });
};

export const onRequestPost = async ({ request, env }) => {
  const { roomCode, state } = await request.json().catch(() => ({}));
  if (!roomCode || state === undefined) {
    return Response.json({ error: "roomCode and state required" }, { status: 400 });
  }

  await env.DB.prepare("INSERT OR IGNORE INTO rooms (code) VALUES (?)").bind(roomCode).run();
  await env.DB.prepare(
    "INSERT INTO room_state (room_code, state_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
  ).bind(roomCode, JSON.stringify(state)).run();

  return Response.json({ ok: true });
};
