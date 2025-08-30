export const onRequestPost: PagesFunction = async ({ params, request, env }) => {
  const roomId = String(params.roomId);
  let joinToken: string | null = null;
  try { ({ joinToken } = await request.json()); } catch {}

  if (joinToken) {
    await env.DB.prepare(
      `DELETE FROM room_sessions WHERE room_id = ? AND join_token = ?`
    ).bind(roomId, joinToken).run();
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
