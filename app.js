// ============================================================
// app.js — entry point: screens, session, navbar, sound engine
// ============================================================

import { supabase } from './supabase-client.js';
import { initAuth, logout } from './auth.js';
import { initGame, startRound } from './game.js';
import { initLeaderboard, openLeaderboard, closeLeaderboard, fetchWorldBest, fetchPersonalBest } from './leaderboard.js';
import { initProfile, openSettings, refreshNavAvatar } from './profile.js';
import { tierFor, tierBadge } from './tiers.js';

// ---------- shared state ----------
export const state = {
  user: null,        // supabase auth user
  username: null,    // from profiles
  personalBest: null, // ms or null
  avatarUrl: null,
  worldBest: null     // { time_ms, user_id } or null
};

// ---------- screen manager ----------
const screens = ['loading', 'auth', 'lobby', 'game', 'result', 'leaderboard', 'settings', 'recovery'];

export function showScreen(name) {
  screens.forEach(s => {
    document.getElementById(`screen-${s}`).classList.toggle('active', s === name);
  });
  if (name !== 'leaderboard') closeLeaderboard(); // drop realtime sub when leaving
}

// ---------- toast ----------
let toastTimer = null;
export function toast(msg, ms = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------- sound engine (Web Audio, no files) ----------
let audioCtx = null;
let muted = JSON.parse(localStorage.getItem('tr67_muted') || 'false');

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, durMs, { type = 'sine', gain = 0.08, distort = false } = {}) {
  if (muted) return;
  try {
    const ac = ctx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = distort ? 'sawtooth' : type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durMs / 1000);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + durMs / 1000);
  } catch { /* audio unavailable — ignore */ }
}

export const sound = {
  tick:  () => beep(800, 30),                                  // correct keypress
  error: () => beep(200, 80, { distort: true, gain: 0.12 }),   // wrong key
  fanfare: () => {                                             // 3-note ascending arpeggio
    if (muted) return;
    [523.25, 659.25, 783.99].forEach((f, i) =>
      setTimeout(() => beep(f, 180, { type: 'triangle', gain: 0.1 }), i * 110));
  },
  sad: () => {                                                 // 3-note descending womp
    if (muted) return;
    [392.0, 329.63, 261.63].forEach((f, i) =>
      setTimeout(() => beep(f, 260, { type: 'triangle', gain: 0.1 }), i * 180));
  }
};

// ---------- world-record FX ----------
export function recordFX(win) {
  const wrap = document.createElement('div');
  wrap.className = 'fx-overlay ' + (win ? 'fx-win' : 'fx-sad');
  const text = win ? 'SIX SEVEN!' : 'six seven…';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'fx-ch';
    s.style.setProperty('--i', i);
    s.textContent = ch === ' ' ? '\u00A0' : ch;
    wrap.appendChild(s);
  });
  if (!win) {
    const cry = document.createElement('span');
    cry.className = 'fx-ch fx-cry';
    cry.style.setProperty('--i', text.length + 1);
    cry.textContent = '😭';
    wrap.appendChild(cry);
  }
  document.body.appendChild(wrap);
  win ? sound.fanfare() : sound.sad();
  setTimeout(() => wrap.classList.add('fx-out'), 2400);
  setTimeout(() => wrap.remove(), 2900);
}

// watch every new score worldwide — cry if someone steals our crown
let recordChannel = null;
function startRecordWatch() {
  if (recordChannel) return;
  recordChannel = supabase
    .channel('record-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' }, payload => {
      const row = payload.new;
      if (!row || typeof row.time_ms !== 'number') return;
      const wb = state.worldBest;
      if (wb && row.time_ms >= wb.time_ms) return; // not a new world record
      const wasMine = !!(wb && state.user && wb.user_id === state.user.id);
      const isMine  = !!(state.user && row.user_id === state.user.id);
      state.worldBest = { time_ms: row.time_ms, user_id: row.user_id };
      if (wasMine && !isMine) recordFX(false); // dethroned 😭
      // our own new record is celebrated locally in game.js
    })
    .subscribe();
}
function stopRecordWatch() {
  if (recordChannel) { supabase.removeChannel(recordChannel); recordChannel = null; }
}

function updateMuteBtn() {
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
}

// ---------- session / login lifecycle ----------
export async function enterLobby() {
  document.getElementById('nav-username').textContent = state.username;
  document.getElementById('profile-chip').classList.remove('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  refreshNavAvatar();
  document.getElementById('lobby-name').textContent = state.username.toUpperCase();

  showScreen('lobby');
  startRecordWatch();

  // load stats (non-blocking, with graceful fallback)
  document.getElementById('lobby-pb').textContent = '…';
  document.getElementById('lobby-world').textContent = '…';

  fetchPersonalBest().then(pb => {
    state.personalBest = pb;
    const el = document.getElementById('lobby-pb');
    el.innerHTML = '';
    if (pb === null) { el.textContent = 'No runs yet'; return; }
    el.appendChild(document.createTextNode(`${pb.toLocaleString()} ms`));
    el.appendChild(tierBadge(pb));
  }).catch(() => { document.getElementById('lobby-pb').textContent = '—'; });

  fetchWorldBest().then(w => {
    state.worldBest = w ? { time_ms: w.time_ms, user_id: w.user_id } : null;
    const el = document.getElementById('lobby-world');
    el.innerHTML = '';
    if (!w) { el.textContent = 'Be the first!'; return; }
    if (w.avatar_url) {
      const img = document.createElement('img');
      img.src = w.avatar_url; img.alt = ''; img.className = 'world-avatar';
      el.appendChild(img);
    }
    el.appendChild(document.createTextNode(`${w.time_ms.toLocaleString()} ms · ${w.username}`));
  }).catch(() => { document.getElementById('lobby-world').textContent = '—'; });
}

export function exitToAuth() {
  stopRecordWatch();
  state.user = null;
  state.username = null;
  state.personalBest = null;
  state.avatarUrl = null;
  document.getElementById('profile-chip').classList.add('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  showScreen('auth');
}

async function restoreSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showScreen('auth'); return; }

    state.user = session.user;
    const { data: profile } = await supabase
      .from('profiles').select('username, avatar_url').eq('id', session.user.id).maybeSingle();

    if (profile) {
      state.username = profile.username;
      state.avatarUrl = profile.avatar_url || null;
    } else {
      // Profile missing (e.g. signed up with email confirmation) — create it now.
      const uname = session.user.user_metadata?.username
        || session.user.email.split('@')[0].replace(/[^A-Za-z0-9_]/g, '_').slice(0, 20);
      const { error } = await supabase.from('profiles').insert({ id: session.user.id, username: uname });
      if (error && error.code !== '23505') throw error;
      state.username = uname;
    }
    await enterLobby();
  } catch (err) {
    console.error(err);
    toast('Could not restore your session. Please log in again.');
    exitToAuth();
  }
}

// ---------- boot ----------
function boot() {
  updateMuteBtn();

  document.getElementById('mute-btn').addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('tr67_muted', JSON.stringify(muted));
    updateMuteBtn();
    if (!muted) sound.tick();
  });

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('play-btn').addEventListener('click', () => startRound());
  document.getElementById('again-btn').addEventListener('click', () => startRound());
  document.getElementById('lobby-leaderboard-btn').addEventListener('click', openLeaderboard);
  document.getElementById('result-leaderboard-btn').addEventListener('click', openLeaderboard);
  document.getElementById('board-back-btn').addEventListener('click', enterLobby);

  document.getElementById('profile-chip').addEventListener('click', openSettings);
  document.getElementById('settings-back-btn').addEventListener('click', enterLobby);

  initAuth();
  initGame();
  initLeaderboard();
  initProfile();

  // React to session expiry / sign-out from any tab
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { state.user = session?.user || state.user; showScreen('recovery'); return; }
    if (event === 'SIGNED_OUT') exitToAuth();
    if (event === 'TOKEN_REFRESHED') console.info('[TypeRace 67] session refreshed');
  });

  restoreSession();
}

boot();
