// api/supabase/[...path].js
// Node serverless function — buffers upstream response to avoid empty JSON on some networks.

const ALLOW_ORIGINS = [
  'https://project-istiqbaal.vercel.app',
  'https://mkd5152.github.io',
  'https://mkd5152.github.io/project-istiqbaal',
  'http://localhost:3000',
];

function corsHeaders(originHeader) {
  const origin = originHeader || '';
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

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    const ch = corsHeaders(req.headers.origin);
    Object.entries(ch).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).end();
    return;
  }

  const upstreamBase = process.env.SUPABASE_URL;       // e.g. https://xxxx.supabase.co
  const anonKey      = process.env.SUPABASE_ANON_KEY;  // anon key

  if (!upstreamBase || !anonKey) {
    const ch = corsHeaders(req.headers.origin);
    Object.entries(ch).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.status(500).end(JSON.stringify({ error: 'Proxy misconfigured' }));
    return;
  }

  // Build upstream URL by stripping /api/supabase/ prefix (keeps query string)
  // req.url includes path + query, e.g. /api/supabase/auth/v1/token?grant_type=password
  const forwardUrl = req.url.replace(/^\/api\/supabase\/?/, '');
  const upstreamUrl = `${upstreamBase}/${forwardUrl}`;

  // Build headers to upstream (drop hop-by-hop & encoding)
  const hdr = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (['host', 'connection', 'content-length', 'accept-encoding'].includes(k.toLowerCase())) continue;
    hdr.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  if (!hdr.get('apikey')) hdr.set('apikey', anonKey);
  if (!hdr.get('x-client-info')) hdr.set('x-client-info', 'vercel-node-proxy');

  let upstreamRes;
  try {
    // Stream request body to upstream (undici needs duplex when streaming)
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: hdr,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: 'half',
      redirect: 'manual',
    });
  } catch (e) {
    const ch = corsHeaders(req.headers.origin);
    Object.entries(ch).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.status(502).end(JSON.stringify({ error: 'Upstream fetch failed', detail: String(e) }));
    return;
  }

  // MATERIALIZE BODY — prevents half/empty stream issues that break JSON parsing on mobile
  let bodyBuf;
  try {
    const ab = await upstreamRes.arrayBuffer();
    bodyBuf = Buffer.from(ab);
  } catch (e) {
    bodyBuf = Buffer.alloc(0);
  }

  // Copy upstream headers (minus hop-by-hop/encoding), then add CORS
  const respHeaders = {};
  upstreamRes.headers.forEach((v, k) => {
    const key = k.toLowerCase();
    if (key === 'content-encoding' || key === 'transfer-encoding' || key === 'content-length') return;
    respHeaders[k] = v;
  });
  const ch = corsHeaders(req.headers.origin);
  Object.entries(ch).forEach(([k, v]) => (respHeaders[k] = v));
  respHeaders['Content-Length'] = String(bodyBuf.byteLength);

  // If body is empty but status expects JSON, return a small JSON so Supabase JS doesn't explode
  if (bodyBuf.byteLength === 0) {
    respHeaders['content-type'] = 'application/json; charset=utf-8';
    res.writeHead(upstreamRes.status || 502, respHeaders);
    res.end(JSON.stringify({ error: 'Empty upstream body', status: upstreamRes.status || 0 }));
    return;
  }

  // Pass-through
  res.writeHead(upstreamRes.status, respHeaders);
  res.end(bodyBuf);
}