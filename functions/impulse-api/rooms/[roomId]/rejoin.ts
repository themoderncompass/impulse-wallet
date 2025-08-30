export const onRequestPost: PagesFunction = async ({ params, request, env }) => {
  const roomId = String(params.roomId);
  const { joinToken } = await request.json().catch(() => ({}));
  if (!joinToken) {
    return new Response(JSON.stringify({ ok: false, error: 'missing token' }), { status: 400 });
  }

  const row = await env.DB.prepare(
    `SELECT room_id, role, expires_at
       FROM room_sessions
      WHERE join_token = ? AND room_id = ? AND expires_at > ?`
  ).bind(joinToken, roomId, Date.now()).first();

  if (!row) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  await env.DB.prepare(`UPDATE room_sessions SET expires_at = ? WHERE join_token = ?`)
    .bind(Date.now() + 1000 * 60 * 60 * 12, joinToken)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
