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

const SUPABASE_URL = 'https://xrrutkbdoiwjrvavmouv.supabase.co';          // e.g. 'https://abcdefgh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycnV0a2Jkb2l3anJ2YXZtb3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTg5MTEsImV4cCI6MjA5Njc5NDkxMX0.sMoCk-e73xyu3-J48A3NhKlTsm_OgTzJqZ9ZU4YZQiQ'; // long string starting with 'eyJ...'

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

if (SUPABASE_URL.startsWith('YOUR_')) {
  console.warn('[TypeRace 67] Replace SUPABASE_URL and SUPABASE_ANON_KEY in supabase-client.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
