import { json } from "./_util";

export const onRequestGet = async ({ env }) => {
  try {
    const r = await env.DB.prepare("select 1 as ok").first();
    return json({ ok: true, db: r?.ok === 1 });
  } catch (e) {
    console.error("health error:", e);
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
};
