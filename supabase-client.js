// ============================================================
// supabase-client.js — initialize the Supabase client
// ============================================================
//
// ▼▼▼ REPLACE THESE TWO VALUES WITH YOUR OWN ▼▼▼
//
// Find them in: Supabase Dashboard → Project Settings → API
//   - "Project URL"        → SUPABASE_URL
//   - "anon public" key    → SUPABASE_ANON_KEY
//
// The anon key is SAFE to ship in frontend code — Row Level
// Security (set up by supabase-setup.sql) protects your data.
// ============================================================

const SUPABASE_URL = 'YOUR_SUPABASE_URL';          // e.g. 'https://abcdefgh.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // long string starting with 'eyJ...'

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

if (SUPABASE_URL.startsWith('YOUR_')) {
  console.warn('[TypeRace 67] Replace SUPABASE_URL and SUPABASE_ANON_KEY in supabase-client.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
