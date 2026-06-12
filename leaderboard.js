// ============================================================
// leaderboard.js — top 20 + Supabase realtime + ranking queries
// ============================================================

import { supabase } from './supabase-client.js';
import { state, showScreen, toast } from './app.js';

const $ = id => document.getElementById(id);

let channel = null;
let knownIds = new Set(); // to flag newly-arrived rows for the slide-in animation

// ---------- data queries ----------

export async function fetchPersonalBest() {
  if (!state.user) return null;
  const { data, error } = await supabase
    .from('scores')
    .select('time_ms')
    .eq('user_id', state.user.id)
    .order('time_ms', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.time_ms : null;
}

export async function fetchWorldBest() {
  const { data, error } = await supabase
    .from('scores')
    .select('time_ms, username')
    .order('time_ms', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Rank this run's time against every player's BEST time (best_scores view). */
export async function fetchRank(timeMs) {
  const [{ count: faster, error: e1 }, { count: total, error: e2 }] = await Promise.all([
    supabase.from('best_scores').select('*', { count: 'exact', head: true }).lt('time_ms', timeMs),
    supabase.from('best_scores').select('*', { count: 'exact', head: true })
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { rank: (faster ?? 0) + 1, total: Math.max(total ?? 1, 1) };
}

async function fetchTop20() {
  // best_scores = each player's single fastest run (view created in supabase-setup.sql)
  const { data, error } = await supabase
    .from('best_scores')
    .select('user_id, username, time_ms, played_at')
    .order('time_ms', { ascending: true })
    .limit(20);
  if (error) throw error;
  return data || [];
}

// ---------- rendering ----------

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function render(rows, { animateNew = false } = {}) {
  const body = $('board-body');
  body.innerHTML = '';

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" class="board-empty">No scores yet — be the first legend on the board! ⚡</td></tr>`;
    return;
  }

  rows.forEach((row, i) => {
    const rank = i + 1;
    const key = `${row.user_id}:${row.time_ms}`;
    const tr = document.createElement('tr');
    if (rank <= 3) tr.classList.add(`rank-${rank}`);
    if (state.user && row.user_id === state.user.id) tr.classList.add('me');
    if (animateNew && !knownIds.has(key)) tr.classList.add('slide-in');

    tr.innerHTML = `
      <td class="rank-cell">${MEDALS[rank] || '#' + rank}</td>
      <td class="name-cell"></td>
      <td class="time-cell">${row.time_ms.toLocaleString()}</td>
      <td class="date-cell">${fmtDate(row.played_at)}</td>`;
    tr.querySelector('.name-cell').textContent = row.username; // safe text insertion
    body.appendChild(tr);
  });

  knownIds = new Set(rows.map(r => `${r.user_id}:${r.time_ms}`));
}

async function renderPersonal(rows) {
  const el = $('board-personal');
  el.classList.add('hidden');
  if (!state.user) return;
  try {
    const pb = await fetchPersonalBest();
    if (pb === null) return;
    const inTop = rows.some(r => r.user_id === state.user.id);
    if (!inTop) {
      const { rank } = await fetchRank(pb);
      el.textContent = `Your personal best: ${pb.toLocaleString()} ms · rank #${rank} (keep pushing! 💪)`;
      el.classList.remove('hidden');
    }
  } catch (err) { console.error(err); }
}

// ---------- realtime ----------

async function refresh({ animateNew = false } = {}) {
  try {
    const rows = await fetchTop20();
    render(rows, { animateNew });
    renderPersonal(rows);
  } catch (err) {
    console.error(err);
    $('board-body').innerHTML =
      `<tr><td colspan="4" class="board-empty">Could not load the leaderboard. Check your connection and reopen this screen.</td></tr>`;
  }
}

export async function openLeaderboard() {
  showScreen('leaderboard');
  knownIds = new Set();
  await refresh();

  // live updates: any INSERT on scores re-renders the board for everyone
  closeLeaderboard();
  channel = supabase
    .channel('scores-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' },
      () => refresh({ animateNew: true }))
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') toast('Live updates unavailable — showing a snapshot.');
    });
}

export function closeLeaderboard() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

export function initLeaderboard() {
  // nothing to wire at boot; buttons are bound in app.js
}

