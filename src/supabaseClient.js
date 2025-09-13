import { createClient } from '@supabase/supabase-js';
import { trackedFetch } from './libs/loading';


const proxyUrl = process.env.REACT_APP_SUPABASE_PROXY_URL;
const directUrl = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseUrl = proxyUrl || directUrl;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase env missing. Check build-time REACT_APP_* in GitHub Actions.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: process.env.REACT_APP_SUPABASE_DB || 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'sb-istiqbaal-auth',
    flowType: 'pkce'
  },
  global: {
    fetch: trackedFetch,
    headers: { 'x-client-info': 'istiqbaal-web/1.0' },
  },
});