export const config = { runtime: 'edge' };

const ALLOW_ORIGINS = [
  'https://project-istiqbaal.vercel.app',
  'https://mkd5152.github.io',
  'https://mkd5152.github.io/project-istiqbaal',
  'http://localhost:3000',
];

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOW_ORIGINS.find((o) => origin.startsWith(o)) || ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api, x-authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  };
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const upstreamBase = process.env.SUPABASE_URL;      // e.g. https://xxxxx.supabase.co
  const anonKey      = process.env.SUPABASE_ANON_KEY; // your anon key

  if (!upstreamBase || !anonKey) {
    return new Response(JSON.stringify({ error: 'Proxy misconfigured' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders(req) },
    });
  }

  const url = new URL(req.url);
  // Strip /api/supabase/ and forward the rest (auth/v1, rest/v1, etc.)
  const forwardPath = url.pathname.replace(/^\/api\/supabase\/?/, '');
  const upstreamUrl = `${upstreamBase}/${forwardPath}${url.search || ''}`;

  const hdr = new Headers(req.headers);
  hdr.delete('host');
  if (!hdr.get('apikey')) hdr.set('apikey', anonKey);
  if (!hdr.get('x-client-info')) hdr.set('x-client-info', 'vercel-edge-proxy');

  const init = {
    method: req.method,
    headers: hdr,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    redirect: 'manual',
  };

  try {
    const upstreamRes = await fetch(upstreamUrl, init);
    const respHeaders = new Headers(upstreamRes.headers);
    const cors = corsHeaders(req);
    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: respHeaders,
    });
  } catch (e) {
    const cors = corsHeaders(req);
    return new Response(JSON.stringify({ error: 'Upstream error', detail: String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }
}