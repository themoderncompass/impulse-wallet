export const onRequestGet: PagesFunction = async ({ params, env }) => {
  const roomId = String(params.roomId);
  const room = await env.DB.prepare(
    `SELECT room_id, name FROM rooms WHERE room_id = ?`
  ).bind(roomId).first();

  return new Response(JSON.stringify({ exists: !!room, name: room?.name || null }), {
    headers: { 'content-type': 'application/json' }
  });
};
