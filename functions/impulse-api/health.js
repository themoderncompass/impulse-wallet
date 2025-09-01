import { json } from "./_util";

export const onRequestGet = ({ env }) => {
  const ok = !!env.DB;
  return new Response(JSON.stringify({ ok, hasDB: ok }), {
    status: ok ? 200 : 500,
    headers: { "content-type": "application/json" }
  });
};
