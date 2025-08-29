export const onRequestGet = async ({ env }) => {
  try {
    const r = await env.DB.prepare("select 1 as ok").first();
    return Response.json({ ok: true, db: r?.ok === 1 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || String(e) }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
};
