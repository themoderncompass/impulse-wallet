export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const roomCode = url.searchParams.get("roomCode");
  if (!roomCode) return Response.json({ error: "roomCode required" }, { status: 400 });

  const row = await env.DB.prepare(
    "SELECT code, created_at FROM rooms WHERE code = ?"
  ).bind(roomCode).first();

  if (!row) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json({ ok: true, room: row });
};

export const onRequestPost = async ({ request, env }) => {
  const { roomCode } = await request.json().catch(() => ({}));
  if (!roomCode) return Response.json({ error: "roomCode required" }, { status: 400 });

  await env.DB.prepare("INSERT OR IGNORE INTO rooms (code) VALUES (?)").bind(roomCode).run();
  const row = await env.DB.prepare("SELECT code, created_at FROM rooms WHERE code = ?").bind(roomCode).first();
  return Response.json({ ok: true, room: row });
};
