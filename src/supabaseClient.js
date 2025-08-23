
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

// Validate configuration
if (!supabaseKey) {
  console.error('REACT_APP_SUPABASE_KEY is not set! Please create a .env file with your Supabase anon key.');
  console.error('Example: REACT_APP_SUPABASE_KEY=your_supabase_anon_key_here');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: process.env.REACT_APP_SUPABASE_DB || 'public' }
})

// Debug: Log the key type (first few characters)
console.log('Supabase key type:', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'Not set');
console.log('Supabase URL:', supabaseUrl);
