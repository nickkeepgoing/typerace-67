// ============================================================
// app.js — entry point: screens, session, navbar, sound engine
// ============================================================

import { supabase } from './supabase-client.js';
import { initAuth, logout } from './auth.js';
import { initGame, startRound } from './game.js';
import { initLeaderboard, openLeaderboard, closeLeaderboard, fetchWorldBest, fetchPersonalBest } from './leaderboard.js';

// ---------- shared state ----------
export const state = {
  user: null,        // supabase auth user
  username: null,    // from profiles
  personalBest: null // ms or null
};

// ---------- screen manager ----------
const screens = ['loading', 'auth', 'lobby', 'game', 'result', 'leaderboard'];

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
  }
};

function updateMuteBtn() {
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
}

// ---------- session / login lifecycle ----------
export async function enterLobby() {
  document.getElementById('nav-username').textContent = state.username;
  document.getElementById('nav-username').classList.remove('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('lobby-name').textContent = state.username.toUpperCase();

  showScreen('lobby');

  // load stats (non-blocking, with graceful fallback)
  document.getElementById('lobby-pb').textContent = '…';
  document.getElementById('lobby-world').textContent = '…';

  fetchPersonalBest().then(pb => {
    state.personalBest = pb;
    document.getElementById('lobby-pb').textContent = pb !== null ? `${pb.toLocaleString()} ms` : 'No runs yet';
  }).catch(() => { document.getElementById('lobby-pb').textContent = '—'; });

  fetchWorldBest().then(w => {
    document.getElementById('lobby-world').textContent =
      w ? `${w.time_ms.toLocaleString()} ms · ${w.username}` : 'Be the first!';
  }).catch(() => { document.getElementById('lobby-world').textContent = '—'; });
}

export function exitToAuth() {
  state.user = null;
  state.username = null;
  state.personalBest = null;
  document.getElementById('nav-username').classList.add('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  showScreen('auth');
}

async function restoreSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showScreen('auth'); return; }

    state.user = session.user;
    const { data: profile } = await supabase
      .from('profiles').select('username').eq('id', session.user.id).maybeSingle();

    if (profile) {
      state.username = profile.username;
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

  initAuth();
  initGame();
  initLeaderboard();

  // React to session expiry / sign-out from any tab
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') exitToAuth();
    if (event === 'TOKEN_REFRESHED') console.info('[TypeRace 67] session refreshed');
  });

  restoreSession();
}

boot();
