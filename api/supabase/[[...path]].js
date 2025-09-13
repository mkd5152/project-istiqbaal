export const config = { runtime: 'edge' };

const ALLOW_ORIGINS = [
  'https://project-istiqbaal.vercel.app',
  'https://mkd5152.github.io',
  'https://mkd5152.github.io/project-istiqbaal',
  'http://localhost:3000',
];

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed =
    ALLOW_ORIGINS.find((o) => origin === o || origin.startsWith(o)) || ALLOW_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, x-client-info, x-supabase-api, x-authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  };
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const upstreamBase = process.env.SUPABASE_URL;      // e.g. https://xxxx.supabase.co
  const anonKey      = process.env.SUPABASE_ANON_KEY; // anon key

  if (!upstreamBase || !anonKey) {
    return new Response(JSON.stringify({ error: 'Proxy misconfigured' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders(req) },
    });
  }

  const url = new URL(req.url);
  const forwardPath = url.pathname.replace(/^\/api\/supabase\/?/, '');
  const upstreamUrl = `${upstreamBase}/${forwardPath}${url.search || ''}`;

  // Build headers to upstream
  const hdr = new Headers(req.headers);
  hdr.delete('host');
  hdr.delete('connection');
  hdr.delete('content-length');
  // Let the platform/negotiate encodings; avoid tricky mobile decoding issues
  hdr.delete('accept-encoding');

  if (!hdr.get('apikey')) hdr.set('apikey', anonKey);
  if (!hdr.get('x-client-info')) hdr.set('x-client-info', 'vercel-edge-proxy');

  // Forward the original request (body included) to upstream
  const upstreamReq = new Request(upstreamUrl, {
    method: req.method,
    headers: hdr,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    redirect: 'manual',
  });

  try {
    const upstreamRes = await fetch(upstreamReq);

    // MATERIALIZE BODY to avoid partial/stream issues on some mobile networks
    const body = await upstreamRes.arrayBuffer();

    // Prepare response headers
    const respHeaders = new Headers(upstreamRes.headers);
    // Remove hop-by-hop/encoding headers that can mismatch when we re-wrap the body
    respHeaders.delete('content-encoding');
    respHeaders.delete('transfer-encoding');
    respHeaders.delete('content-length'); // let browser compute it
    // CORS
    const cors = corsHeaders(req);
    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);

    // Ensure JSON content-type is preserved for GoTrue (auth) responses
    if (!respHeaders.has('content-type')) {
      respHeaders.set('content-type', 'application/json; charset=utf-8');
    }

    return new Response(body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
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